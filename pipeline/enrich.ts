/**
 * AI enrichment step (brief §7). Runs AFTER ingestion and is fully incremental:
 *
 *  - Theme tagging (cheap, Haiku) on every dossier not yet tagged → dossier_themes.
 *  - Explanations + summaries (costly, Sonnet) on the significant scrutins only
 *    (solennel, motion de censure, or vote on the whole text) not yet enriched
 *    (or whose source changed) → scrutin_ai.
 *
 * Each item is enriched independently; one failure is logged and skipped rather
 * than aborting the run. A backfill is one-off; subsequent runs only touch new
 * dossiers/scrutins.
 *
 * Session summaries are intentionally NOT generated here: they require the
 * full séance debate text (comptes rendus), which the pipeline does not yet
 * ingest. Generating them from the data we have would violate the grounding
 * rule, so they are left for a later iteration.
 *
 * Run with: `npm run enrich`  (env: ANTHROPIC_API_KEY; optional AI_LIMIT, ENRICH_ONLY)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { eq, inArray, or, sql } from "drizzle-orm";

import { db, schema } from "./db";
import { sleep } from "./lib/util";
import { TAGGING_MODEL, WRITING_MODEL, isRateLimited } from "./ai/client";
import { tagDossierThemes } from "./ai/tag-themes";
import {
  explainScrutin,
  explanationSource,
  type ScrutinInput,
} from "./ai/explain-scrutin";

const STATE_FILE = resolve(process.cwd(), "data/last-enrich.json");

// Vote-type codes whose scrutins are significant enough for costly enrichment.
const SIGNIFICANT_CODES = ["SPS", "MOC"];

// Delay between calls to stay within the free-tier per-minute rate limit.
const DELAY_MS = Number(process.env.AI_DELAY_MS) || 1200;

function log(msg: string) {
  console.log(`[enrich] ${msg}`);
}

function hashSource(model: string, source: string): string {
  return createHash("sha256").update(`${model}\n${source}`).digest("hex");
}

async function tagThemes(limit: number): Promise<{ dossiers: number; themes: number }> {
  // Dossiers not yet processed by the tagging step.
  let pending = await db
    .select({ id: schema.dossiers.id, titre: schema.dossiers.titre, type: schema.dossiers.type })
    .from(schema.dossiers)
    .where(sql`${schema.dossiers.themesTaggedAt} IS NULL`);

  log(`${pending.length} dossiers to tag`);
  if (limit > 0) pending = pending.slice(0, limit);

  let themeCount = 0;
  let done = 0;
  for (const d of pending) {
    try {
      const themes = await tagDossierThemes({ titre: d.titre, type: d.type });
      if (themes.length > 0) {
        await db
          .insert(schema.dossierThemes)
          .values(themes.map((theme) => ({ dossierId: d.id, theme })))
          .onConflictDoNothing();
        themeCount += themes.length;
      }
      // Mark as processed regardless of how many themes were found.
      await db
        .update(schema.dossiers)
        .set({ themesTaggedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(schema.dossiers.id, d.id));
    } catch (err) {
      if (isRateLimited(err)) {
        log(`  rate limit reached — stopping tagging (resumes next run)`);
        break;
      }
      log(`  dossier ${d.id} failed: ${(err as Error)?.message ?? err}`);
      continue;
    }
    if (++done % 50 === 0) log(`  tagged ${done}/${pending.length}`);
    await sleep(DELAY_MS);
  }
  return { dossiers: done, themes: themeCount };
}

async function explainScrutins(limit: number): Promise<number> {
  // Eligible = solennel / motion de censure / vote on the whole text.
  const eligible = await db
    .select({ s: schema.scrutins, dTitre: schema.dossiers.titre, dType: schema.dossiers.type })
    .from(schema.scrutins)
    .leftJoin(schema.dossiers, eq(schema.dossiers.id, schema.scrutins.dossierId))
    .where(
      or(
        inArray(schema.scrutins.typeCode, SIGNIFICANT_CODES),
        eq(schema.scrutins.isFinal, true),
      ),
    );

  // Existing enrichment keyed by source hash, to skip unchanged ones.
  const existing = new Map(
    (
      await db
        .select({ id: schema.scrutinAi.scrutinId, hash: schema.scrutinAi.sourceHash })
        .from(schema.scrutinAi)
    ).map((r) => [r.id, r.hash]),
  );

  let todo = eligible.filter((row) => {
    const input: ScrutinInput = {
      titre: row.s.titre,
      objet: row.s.objet,
      dossierTitre: row.dTitre,
      dossierType: row.dType,
    };
    return existing.get(row.s.id) !== hashSource(WRITING_MODEL, explanationSource(input));
  });

  log(`${eligible.length} eligible scrutins, ${todo.length} need enrichment`);
  if (limit > 0) todo = todo.slice(0, limit);

  let done = 0;
  for (const row of todo) {
    const input: ScrutinInput = {
      titre: row.s.titre,
      objet: row.s.objet,
      dossierTitre: row.dTitre,
      dossierType: row.dType,
    };
    try {
      const { explanation, summary } = await explainScrutin(input);
      const sourceHash = hashSource(WRITING_MODEL, explanationSource(input));
      await db
        .insert(schema.scrutinAi)
        .values({
          scrutinId: row.s.id,
          explanation,
          summary,
          model: WRITING_MODEL,
          sourceHash,
          generatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .onConflictDoUpdate({
          target: schema.scrutinAi.scrutinId,
          set: {
            explanation,
            summary,
            model: WRITING_MODEL,
            sourceHash,
            generatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
    } catch (err) {
      if (isRateLimited(err)) {
        log(`  rate limit reached — stopping explanations (resumes next run)`);
        break;
      }
      log(`  scrutin ${row.s.id} failed: ${(err as Error)?.message ?? err}`);
      continue;
    }
    if (++done % 10 === 0) log(`  explained ${done}/${todo.length}`);
    await sleep(DELAY_MS);
  }
  return done;
}

async function main() {
  const startedAt = new Date();
  log(`starting at ${startedAt.toISOString()} (tagging=${TAGGING_MODEL}, writing=${WRITING_MODEL})`);

  // Optional cap for cheap test runs (e.g. AI_LIMIT=10), and a scope switch.
  const limit = Number(process.env.AI_LIMIT) || 0;
  const only = process.env.ENRICH_ONLY; // "themes" | "scrutins" | undefined (both)

  let themes = { dossiers: 0, themes: 0 };
  let explained = 0;

  // Explanations first: they are the high-value, small set (~230 significant
  // scrutins). Theme tagging (thousands of dossiers) then fills the remaining
  // budget and converges over subsequent runs under the free-tier limits.
  if (only !== "themes") explained = await explainScrutins(limit);
  if (only !== "scrutins") themes = await tagThemes(limit);

  const finishedAt = new Date();
  const state = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    models: { tagging: TAGGING_MODEL, writing: WRITING_MODEL },
    counts: {
      dossiersTagged: themes.dossiers,
      themesAdded: themes.themes,
      scrutinsExplained: explained,
    },
  };
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  log(
    `done in ${(state.durationMs / 1000).toFixed(1)}s — ` +
      `${themes.dossiers} dossiers tagged (+${themes.themes} themes), ${explained} scrutins explained`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[enrich] FAILED:", err);
    process.exit(1);
  });
