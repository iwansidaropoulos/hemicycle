/**
 * Ingestion pipeline entry point (brief §6).
 *
 * Downloads the official open-data archives, parses them, and upserts the raw
 * data into Turso:
 *   reference data (groups, deputies, dossiers, sessions) is refreshed every
 *   run; scrutins (and their per-group results and per-deputy votes) are
 *   ingested INCREMENTALLY — only uids not already in the database are
 *   processed, so a daily run is cheap and re-runs never duplicate work.
 *
 * No LLM calls happen here — AI enrichment is a separate, later step.
 *
 * Run with: `npm run ingest`
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { sql } from "drizzle-orm";

import { db, schema } from "./db";
import { DATASETS } from "./config";
import { downloadAndIterate, downloadJsonArchive } from "./lib/archive";
import { chunk, withRetry } from "./lib/util";
import { parseGroups, type ParsedGroup, type RawOrgane } from "./parse/groups";
import { parseDeputies, type RawActeur } from "./parse/deputies";
import { parseDossiers, type RawDossier } from "./parse/dossiers";
import { parseScrutin, type RawScrutinFile } from "./parse/scrutins";

const STATE_FILE = resolve(process.cwd(), "data/last-run.json");
// Conservative row-per-statement cap (well under SQLite's variable limit).
const BATCH = 800;
// Scrutins processed (and committed) per flush, so the backfill is resumable.
const BATCH_SCRUTINS = 250;

function log(msg: string) {
  console.log(`[ingest] ${msg}`);
}

/**
 * Insert rows in chunks, skipping rows that conflict on the primary key. Each
 * chunk is retried with backoff so a transient libSQL/network error during the
 * large backfill does not abort the whole run.
 */
async function insertChunked<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  label = "insert",
): Promise<number> {
  if (rows.length === 0) return 0;
  for (const part of chunk(rows, BATCH)) {
    await withRetry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => db.insert(table).values(part as any).onConflictDoNothing(),
      { label },
    );
  }
  return rows.length;
}

async function main() {
  const startedAt = new Date();
  log(`starting at ${startedAt.toISOString()}`);

  // --- 1. Download the (small) reference archives in parallel. ----------
  log("downloading reference archives...");
  const [organeEntries, acteurEntries, dossierEntries] = await Promise.all([
    downloadJsonArchive<RawOrgane>(DATASETS.acteurs, (p) =>
      p.includes("/organe/"),
    ),
    downloadJsonArchive<RawActeur>(DATASETS.acteurs, (p) =>
      p.includes("/acteur/"),
    ),
    downloadJsonArchive<RawDossier>(DATASETS.dossiers, (p) =>
      p.includes("/dossierParlementaire/"),
    ),
  ]);
  log(
    `downloaded: ${organeEntries.length} organes, ${acteurEntries.length} acteurs, ` +
      `${dossierEntries.length} dossiers`,
  );

  // --- 2. Parse reference data. ----------------------------------------
  const deputies = parseDeputies(acteurEntries);
  const dossiers = parseDossiers(dossierEntries);
  const baseGroups = parseGroups(organeEntries);

  // Group headcount (effectif) = number of deputies currently in the group.
  const headcount = new Map<string, number>();
  for (const d of deputies) {
    if (d.groupId) headcount.set(d.groupId, (headcount.get(d.groupId) ?? 0) + 1);
  }
  const groups = baseGroups.map((g: ParsedGroup) => ({
    ...g,
    effectif: headcount.get(g.id) ?? 0,
  }));

  // --- 3. Upsert reference data (refreshed every run). ------------------
  log("upserting reference data (groups, deputies, dossiers)...");
  await upsertGroups(groups);
  await upsertDeputies(deputies);
  await upsertDossiers(dossiers);

  // --- 4. Incremental, resumable scrutins. -----------------------------
  // A scrutin is considered fully ingested once it has per-group results, which
  // are written LAST in each batch (after the scrutin row and its votes). So
  // this "done" set is a correct resume marker even if a previous run crashed
  // mid-backfill: any unfinished scrutin is simply reprocessed.
  const doneIds = new Set(
    (
      await db
        .selectDistinct({ id: schema.scrutinGroupResults.scrutinId })
        .from(schema.scrutinGroupResults)
    ).map((r) => r.id),
  );
  log(`${doneIds.size} scrutins already ingested (will be skipped)`);

  // Stream-parse the large scrutins archive so we don't retain raw JSON for all
  // ~7400 files at once.
  const limit = Number(process.env.INGEST_LIMIT) || 0;
  const newScrutins: ReturnType<typeof parseScrutin>[] = [];
  let totalScrutins = 0;
  await downloadAndIterate<RawScrutinFile>(DATASETS.scrutins, (_path, data) => {
    totalScrutins++;
    const uid = data?.scrutin?.uid;
    if (!uid || doneIds.has(uid)) return;
    if (limit > 0 && newScrutins.length >= limit) return;
    newScrutins.push(parseScrutin(data));
  });
  log(`${newScrutins.length} new scrutins to ingest (of ${totalScrutins})`);

  let scrutinsInserted = 0;
  let groupResultsInserted = 0;
  let votesInserted = 0;
  let sessionsNew = 0;
  const sessionSeen = new Set<string>();

  const batches = chunk(newScrutins, BATCH_SCRUTINS);
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];

    const sessions = [];
    for (const p of batch) {
      if (p.session && !sessionSeen.has(p.session.id)) {
        sessionSeen.add(p.session.id);
        sessions.push(p.session);
      }
    }
    await insertChunked(schema.sessions, sessions, "sessions");
    sessionsNew += sessions.length;

    // Order matters for resumability: scrutin rows, then votes, then group
    // results LAST (the done-marker). FK votes.scrutin_id needs the scrutin row.
    scrutinsInserted += await insertChunked(
      schema.scrutins,
      batch.map((p) => p.scrutin),
      "scrutins",
    );
    votesInserted += await insertChunked(
      schema.votes,
      batch.flatMap((p) => p.votes),
      "votes",
    );
    groupResultsInserted += await insertChunked(
      schema.scrutinGroupResults,
      batch.flatMap((p) => p.groupResults),
      "group_results",
    );

    if (bi % 5 === 0 || bi === batches.length - 1) {
      log(
        `batch ${bi + 1}/${batches.length} — ${scrutinsInserted} scrutins, ${votesInserted} votes`,
      );
    }
  }

  // --- 5. Write committed state file (trace + keeps repo active). -------
  const finishedAt = new Date();
  const state = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    counts: {
      groups: groups.length,
      deputies: deputies.length,
      dossiers: dossiers.length,
      sessionsNew,
      scrutinsTotalAvailable: totalScrutins,
      scrutinsInDbBefore: doneIds.size,
      scrutinsInserted,
      groupResultsInserted,
      votesInserted,
    },
    datasets: DATASETS,
  };
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  log(`wrote state to ${STATE_FILE}`);
  log(
    `done in ${(state.durationMs / 1000).toFixed(1)}s — ` +
      `+${scrutinsInserted} scrutins, +${votesInserted} votes`,
  );

  // --- 6. Trigger app revalidation if anything new was added. -----------
  if (scrutinsInserted > 0 && process.env.VERCEL_DEPLOY_HOOK_URL) {
    log("new data ingested — triggering Vercel deploy hook...");
    const res = await fetch(process.env.VERCEL_DEPLOY_HOOK_URL, {
      method: "POST",
    });
    log(`deploy hook responded ${res.status}`);
  }
}

// --- Upsert helpers (refresh-on-conflict) --------------------------------

async function upsertGroups(rows: Array<ParsedGroup & { effectif: number }>) {
  for (const part of chunk(rows, BATCH)) {
    await db
      .insert(schema.groups)
      .values(part)
      .onConflictDoUpdate({
        target: schema.groups.id,
        set: {
          libelle: sqlExcluded("libelle"),
          abrege: sqlExcluded("abrege"),
          couleur: sqlExcluded("couleur"),
          effectif: sqlExcluded("effectif"),
        },
      });
  }
}

async function upsertDeputies(
  rows: Array<{ id: string; nom: string; prenom: string; groupId: string | null }>,
) {
  for (const part of chunk(rows, BATCH)) {
    await db
      .insert(schema.deputies)
      .values(part)
      .onConflictDoUpdate({
        target: schema.deputies.id,
        set: {
          nom: sqlExcluded("nom"),
          prenom: sqlExcluded("prenom"),
          groupId: sqlExcluded("group_id"),
        },
      });
  }
}

async function upsertDossiers(
  rows: Array<{ id: string; titre: string; type: string | null; url: string | null }>,
) {
  for (const part of chunk(rows, BATCH)) {
    await db
      .insert(schema.dossiers)
      .values(part)
      .onConflictDoUpdate({
        target: schema.dossiers.id,
        set: {
          titre: sqlExcluded("titre"),
          type: sqlExcluded("type"),
          url: sqlExcluded("url"),
        },
      });
  }
}

/** Reference the conflicting row's column in an upsert SET clause. */
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ingest] FAILED:", err);
    process.exit(1);
  });
