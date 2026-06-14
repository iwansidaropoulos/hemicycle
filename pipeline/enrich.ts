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
 * Session summaries are generated from the official verbatim record (compte
 * rendu, downloaded per run), focused on the disagreements between groups.
 *
 * Run with: `npm run enrich`  (env: GEMINI_API_KEY; optional AI_LIMIT, ENRICH_ONLY)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import { db, schema } from "./db";
import { chunk, sleep } from "./lib/util";
import { loadComptesRendus, interventionsForSeance } from "./lib/comptes-rendus";
import { TAGGING_MODEL, WRITING_MODEL, isRateLimited } from "./ai/client";
import { tagDossiersBatch } from "./ai/tag-themes";
import {
  explainScrutinFromDebate,
  explanationSource,
  type ScrutinInput,
} from "./ai/explain-scrutin";
import type { Intervention } from "./parse/comptes-rendus";
import {
  buildTranscript,
  summarizeSession,
  type SessionIntervention,
} from "./ai/summarize-session";

const STATE_FILE = resolve(process.cwd(), "data/last-enrich.json");

// Vote-type codes whose scrutins are significant enough for costly enrichment.
const SIGNIFICANT_CODES = ["SPS", "MOC"];

// Delay between requests (the free tier caps requests/day, not per-second).
const DELAY_MS = Number(process.env.AI_DELAY_MS) || 1500;
// Dossiers per tagging request — batching keeps within the free-tier daily
// request quota (~20 requests/day per model). Explanations are grounded
// (Google Search), so they run one scrutin per request.
const TAG_BATCH = Number(process.env.TAG_BATCH) || 40;

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

// Speakers that are pure procedure (the sitting's president) — skipped.
const PRESIDENT_RE = /^(mme|m\.)\s+(la présidente|le président)$/i;

/** Map deputy uid → group label (abbrev) for attributing speakers to groups. */
async function loadGroupByDeputy(): Promise<Map<string, string | null>> {
  return new Map(
    (
      await db
        .select({
          id: schema.deputies.id,
          abrege: schema.groups.abrege,
          libelle: schema.groups.libelle,
        })
        .from(schema.deputies)
        .leftJoin(schema.groups, eq(schema.groups.id, schema.deputies.groupId))
    ).map((r) => [r.id, r.abrege ?? r.libelle ?? null]),
  );
}

/** Turn raw interventions into labelled, de-noised ones for the LLM. */
function toSessionInterventions(
  interventions: Intervention[],
  groupByDeputy: Map<string, string | null>,
): SessionIntervention[] {
  return interventions
    .filter((i) => !PRESIDENT_RE.test(i.speaker) && i.text.length >= 40)
    .map((i) => ({
      speaker: i.speaker,
      group: i.acteurId ? groupByDeputy.get(i.acteurId) ?? null : null,
      text: i.text,
    }));
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

  const existing = new Map(
    (
      await db
        .select({ id: schema.scrutinAi.scrutinId, hash: schema.scrutinAi.sourceHash })
        .from(schema.scrutinAi)
    ).map((r) => [r.id, r.hash]),
  );

  const inputOf = (row: (typeof eligible)[number]): ScrutinInput => ({
    titre: row.s.titre,
    objet: row.s.objet,
    dossierTitre: row.dTitre,
    dossierType: row.dType,
  });
  // Tagged "|debate" so switching strategy (web → compte rendu) re-generates.
  const hashOf = (row: (typeof eligible)[number]) =>
    hashSource(`${WRITING_MODEL}|debate`, explanationSource(inputOf(row)));

  let todo = eligible.filter((row) => existing.get(row.s.id) !== hashOf(row));
  const priority = (row: (typeof eligible)[number]) =>
    SIGNIFICANT_CODES.includes(row.s.typeCode ?? "") ? 0 : 1;
  todo.sort(
    (a, b) => priority(a) - priority(b) || (b.s.date ?? "").localeCompare(a.s.date ?? ""),
  );

  log(`${eligible.length} eligible scrutins, ${todo.length} need enrichment`);
  if (limit > 0) todo = todo.slice(0, limit);
  if (todo.length === 0) return 0;

  const index = await loadComptesRendus();
  const groupByDeputy = await loadGroupByDeputy();

  let done = 0;
  for (const row of todo) {
    // Ground in the séance's debate transcript (empty if no record exists).
    const interv = row.s.sessionId
      ? interventionsForSeance(index, row.s.sessionId)
      : null;
    const transcript = interv
      ? buildTranscript(toSessionInterventions(interv, groupByDeputy))
      : "";

    let result;
    try {
      result = await callWithBackoff(() =>
        explainScrutinFromDebate(inputOf(row), transcript),
      );
    } catch (err) {
      if (isRateLimited(err)) {
        log(`  daily quota reached — stopping explanations (resumes next run)`);
        break;
      }
      log(`  scrutin ${row.s.id} failed: ${(err as Error)?.message ?? err}`);
      continue;
    }

    const set = {
      explanation: result.explanation,
      summary: result.summary,
      sources: null,
      model: WRITING_MODEL,
      sourceHash: hashOf(row),
      generatedAt: sql`CURRENT_TIMESTAMP`,
    };
    await db
      .insert(schema.scrutinAi)
      .values({ scrutinId: row.s.id, ...set })
      .onConflictDoUpdate({ target: schema.scrutinAi.scrutinId, set });

    if (++done % 5 === 0 || done === todo.length) {
      log(`  explained ${done}/${todo.length} scrutins`);
    }
    await sleep(DELAY_MS);
  }
  return done;
}

async function summarizeSessions(limit: number): Promise<number> {
  const summarized = new Set(
    (await db.select({ id: schema.sessionAi.sessionId }).from(schema.sessionAi)).map(
      (r) => r.id,
    ),
  );
  const allSessions = await db
    .select({ id: schema.sessions.id, date: schema.sessions.date })
    .from(schema.sessions);
  let pending = allSessions.filter((s) => !summarized.has(s.id));
  if (pending.length === 0) {
    log("no sessions to summarize");
    return 0;
  }

  // Prioritize séances that contain a significant (eligible) scrutin, recent first.
  const eligibleSeances = new Set(
    (
      await db
        .selectDistinct({ id: schema.scrutins.sessionId })
        .from(schema.scrutins)
        .where(
          or(
            inArray(schema.scrutins.typeCode, SIGNIFICANT_CODES),
            eq(schema.scrutins.isFinal, true),
          ),
        )
    )
      .map((r) => r.id)
      .filter((x): x is string => !!x),
  );
  pending.sort(
    (a, b) =>
      Number(eligibleSeances.has(b.id)) - Number(eligibleSeances.has(a.id)) ||
      (b.date ?? "").localeCompare(a.date ?? ""),
  );
  if (limit > 0) pending = pending.slice(0, limit);

  log(`${pending.length} sessions to summarize`);
  const index = await loadComptesRendus();
  const groupByDeputy = await loadGroupByDeputy();

  let count = 0;
  for (const session of pending) {
    const interv = interventionsForSeance(index, session.id);
    const items = interv ? toSessionInterventions(interv, groupByDeputy) : [];
    if (items.length === 0) {
      // No usable record — mark processed (empty) so we don't retry forever.
      await db
        .insert(schema.sessionAi)
        .values({ sessionId: session.id, summary: "", model: WRITING_MODEL, generatedAt: sql`CURRENT_TIMESTAMP` })
        .onConflictDoNothing();
      continue;
    }

    let summary: string;
    try {
      summary = await callWithBackoff(() => summarizeSession(buildTranscript(items)));
    } catch (err) {
      if (isRateLimited(err)) {
        log(`  daily quota reached — stopping session summaries (resumes next run)`);
        break;
      }
      log(`  session ${session.id} failed: ${(err as Error)?.message ?? err}`);
      continue;
    }

    const set = {
      summary,
      model: WRITING_MODEL,
      sourceHash: hashSource(`${WRITING_MODEL}|session`, session.id),
      generatedAt: sql`CURRENT_TIMESTAMP`,
    };
    await db
      .insert(schema.sessionAi)
      .values({ sessionId: session.id, ...set })
      .onConflictDoUpdate({ target: schema.sessionAi.sessionId, set });

    if (++count % 5 === 0 || count === pending.length) {
      log(`  summarized ${count}/${pending.length} sessions`);
    }
    await sleep(DELAY_MS);
  }
  return count;
}

async function main() {
  const startedAt = new Date();
  log(`starting at ${startedAt.toISOString()} (tagging=${TAGGING_MODEL}, writing=${WRITING_MODEL})`);

  // Optional cap for cheap test runs (e.g. AI_LIMIT=10), and a scope switch.
  const limit = Number(process.env.AI_LIMIT) || 0;
  // "themes" | "scrutins" | "sessions" | undefined (all)
  const only = process.env.ENRICH_ONLY;

  let themes = { dossiers: 0, themes: 0 };
  let explained = 0;
  let sessions = 0;

  // Order by value: scrutin explanations, then session summaries, then theme
  // tagging. Each stops on the free-tier quota and resumes next run.
  if (!only || only === "scrutins") explained = await explainScrutins(limit);
  if (!only || only === "sessions") sessions = await summarizeSessions(limit);
  if (!only || only === "themes") themes = await tagThemes(limit);

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
      sessionsSummarized: sessions,
    },
  };
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  log(
    `done in ${(state.durationMs / 1000).toFixed(1)}s — ` +
      `+${explained} scrutins, +${sessions} sessions, ${themes.dossiers} dossiers tagged`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[enrich] FAILED:", err);
    process.exit(1);
  });
