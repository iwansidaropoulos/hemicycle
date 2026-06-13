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
 * Run with: `npm run enrich`  (env: GEMINI_API_KEY; optional AI_LIMIT, ENRICH_ONLY)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import { db, schema } from "./db";
import { chunk, sleep } from "./lib/util";
import { TAGGING_MODEL, WRITING_MODEL, isRateLimited } from "./ai/client";
import { tagDossiersBatch } from "./ai/tag-themes";
import {
  explainScrutinsBatch,
  explanationSource,
  type ScrutinBatchItem,
  type ScrutinInput,
} from "./ai/explain-scrutin";

const STATE_FILE = resolve(process.cwd(), "data/last-enrich.json");

// Vote-type codes whose scrutins are significant enough for costly enrichment.
const SIGNIFICANT_CODES = ["SPS", "MOC"];

// Delay between requests (the free tier caps requests/day, not per-second).
const DELAY_MS = Number(process.env.AI_DELAY_MS) || 1500;
// Items per request — batching keeps the backfill within the free-tier
// daily request quota (~20 requests/day per model).
const TAG_BATCH = Number(process.env.TAG_BATCH) || 40;
const EXPLAIN_BATCH = Number(process.env.EXPLAIN_BATCH) || 10;

function log(msg: string) {
  console.log(`[enrich] ${msg}`);
}

function hashSource(model: string, source: string): string {
  return createHash("sha256").update(`${model}\n${source}`).digest("hex");
}

// Backoff waits (ms) for transient per-minute rate limits. If a call still gets
// rate-limited after the last wait, we treat it as the daily quota being
// exhausted and let the caller stop the run (it resumes next time).
const BACKOFF_MS = [20_000, 40_000, 60_000];

/** Run an AI call, waiting out per-minute rate limits; rethrows on exhaustion. */
async function callWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimited(err) && attempt < BACKOFF_MS.length) {
        log(`  rate limited — waiting ${BACKOFF_MS[attempt] / 1000}s before retry`);
        await sleep(BACKOFF_MS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

async function tagThemes(limit: number): Promise<{ dossiers: number; themes: number }> {
  // Dossiers not yet processed by the tagging step.
  let pending = await db
    .select({ id: schema.dossiers.id, titre: schema.dossiers.titre, type: schema.dossiers.type })
    .from(schema.dossiers)
    .where(sql`${schema.dossiers.themesTaggedAt} IS NULL`);

  // Prioritize dossiers actually referenced by scrutins: only those make the
  // theme filter useful (scrutins inherit their dossier's themes). The many
  // dossiers with no scrutin — reports, studies — are tagged afterwards.
  const linked = new Set(
    (
      await db
        .selectDistinct({ id: schema.scrutins.dossierId })
        .from(schema.scrutins)
        .where(isNotNull(schema.scrutins.dossierId))
    ).map((r) => r.id),
  );
  pending.sort((a, b) => Number(linked.has(b.id)) - Number(linked.has(a.id)));

  log(`${pending.length} dossiers to tag (${linked.size} referenced by scrutins, tagged first)`);
  if (limit > 0) pending = pending.slice(0, limit);

  let themeCount = 0;
  let done = 0;
  const batches = chunk(pending, TAG_BATCH);
  for (const batch of batches) {
    let map: Map<string, string[]>;
    try {
      map = await callWithBackoff(() => tagDossiersBatch(batch));
    } catch (err) {
      if (isRateLimited(err)) {
        log(`  daily quota reached — stopping tagging (resumes next run)`);
        break;
      }
      log(`  batch failed: ${(err as Error)?.message ?? err}`);
      continue;
    }

    // Insert all themes for the batch in one statement, then mark the dossiers.
    const rows = batch.flatMap((d) =>
      (map.get(d.id) ?? []).map((theme) => ({ dossierId: d.id, theme })),
    );
    if (rows.length > 0) {
      await db.insert(schema.dossierThemes).values(rows).onConflictDoNothing();
      themeCount += rows.length;
    }
    await db
      .update(schema.dossiers)
      .set({ themesTaggedAt: sql`CURRENT_TIMESTAMP` })
      .where(inArray(schema.dossiers.id, batch.map((d) => d.id)));

    done += batch.length;
    log(`  tagged ${done}/${pending.length} dossiers (+${themeCount} themes)`);
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

  // Pre-build the grounded input for each scrutin (also used for the hash).
  const inputs = new Map<string, ScrutinInput>(
    todo.map((row) => [
      row.s.id,
      {
        titre: row.s.titre,
        objet: row.s.objet,
        dossierTitre: row.dTitre,
        dossierType: row.dType,
      },
    ]),
  );

  let done = 0;
  const batches = chunk(todo, EXPLAIN_BATCH);
  for (const batch of batches) {
    const items: ScrutinBatchItem[] = batch.map((row) => ({
      id: row.s.id,
      ...inputs.get(row.s.id)!,
    }));
    let map: Map<string, { explanation: string; summary: string }>;
    try {
      map = await callWithBackoff(() => explainScrutinsBatch(items));
    } catch (err) {
      if (isRateLimited(err)) {
        log(`  daily quota reached — stopping explanations (resumes next run)`);
        break;
      }
      log(`  batch failed: ${(err as Error)?.message ?? err}`);
      continue;
    }

    for (const row of batch) {
      const r = map.get(row.s.id);
      if (!r) continue;
      const sourceHash = hashSource(
        WRITING_MODEL,
        explanationSource(inputs.get(row.s.id)!),
      );
      await db
        .insert(schema.scrutinAi)
        .values({
          scrutinId: row.s.id,
          explanation: r.explanation,
          summary: r.summary,
          model: WRITING_MODEL,
          sourceHash,
          generatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .onConflictDoUpdate({
          target: schema.scrutinAi.scrutinId,
          set: {
            explanation: r.explanation,
            summary: r.summary,
            model: WRITING_MODEL,
            sourceHash,
            generatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
      done++;
    }
    log(`  explained ${done}/${todo.length} scrutins`);
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
