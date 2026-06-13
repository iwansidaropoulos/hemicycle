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
import { downloadJsonArchive } from "./lib/archive";
import { chunk } from "./lib/util";
import { parseGroups, type ParsedGroup, type RawOrgane } from "./parse/groups";
import { parseDeputies, type RawActeur } from "./parse/deputies";
import { parseDossiers, type RawDossier } from "./parse/dossiers";
import { parseScrutin, type RawScrutinFile } from "./parse/scrutins";

const STATE_FILE = resolve(process.cwd(), "data/last-run.json");
// Conservative row-per-statement caps (well under SQLite's variable limit).
const BATCH = 800;

function log(msg: string) {
  console.log(`[ingest] ${msg}`);
}

/** Insert rows in chunks, skipping rows that conflict on the primary key. */
async function insertChunked<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
): Promise<number> {
  if (rows.length === 0) return 0;
  for (const part of chunk(rows, BATCH)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(part as any).onConflictDoNothing();
  }
  return rows.length;
}

async function main() {
  const startedAt = new Date();
  log(`starting at ${startedAt.toISOString()}`);

  // --- 1. Download all three archives in parallel. ----------------------
  log("downloading archives...");
  const [organeEntries, acteurEntries, dossierEntries, scrutinEntries] =
    await Promise.all([
      downloadJsonArchive<RawOrgane>(DATASETS.acteurs, (p) =>
        p.includes("/organe/"),
      ),
      downloadJsonArchive<RawActeur>(DATASETS.acteurs, (p) =>
        p.includes("/acteur/"),
      ),
      downloadJsonArchive<RawDossier>(DATASETS.dossiers, (p) =>
        p.includes("/dossierParlementaire/"),
      ),
      downloadJsonArchive<RawScrutinFile>(DATASETS.scrutins),
    ]);
  log(
    `downloaded: ${organeEntries.length} organes, ${acteurEntries.length} acteurs, ` +
      `${dossierEntries.length} dossiers, ${scrutinEntries.length} scrutins`,
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

  // --- 4. Incremental scrutins. ----------------------------------------
  const existing = new Set(
    (await db.select({ id: schema.scrutins.id }).from(schema.scrutins)).map(
      (r) => r.id,
    ),
  );
  log(`${existing.size} scrutins already in DB`);

  const newScrutins: ReturnType<typeof parseScrutin>[] = [];
  for (const { data } of scrutinEntries) {
    if (!data?.scrutin?.uid) continue;
    if (existing.has(data.scrutin.uid)) continue;
    newScrutins.push(parseScrutin(data));
  }
  // Optional cap, for testing the pipeline on a small batch (e.g. INGEST_LIMIT=20).
  const limit = Number(process.env.INGEST_LIMIT) || 0;
  if (limit > 0 && newScrutins.length > limit) {
    log(`INGEST_LIMIT=${limit} — capping from ${newScrutins.length} new scrutins`);
    newScrutins.length = limit;
  }
  log(`${newScrutins.length} new scrutins to ingest`);

  // Sessions are shared across scrutins; dedupe by id before inserting.
  const sessionMap = new Map<string, { id: string; date: string | null }>();
  const scrutinRows = newScrutins.map((p) => p.scrutin);
  const groupResultRows = newScrutins.flatMap((p) => p.groupResults);
  const voteRows = newScrutins.flatMap((p) => p.votes);
  for (const p of newScrutins) {
    if (p.session) sessionMap.set(p.session.id, p.session);
  }

  await insertChunked(schema.sessions, [...sessionMap.values()]);
  // Insert scrutins before their child rows (foreign keys are declarative).
  const scrutinsInserted = await insertChunked(schema.scrutins, scrutinRows);
  const groupResultsInserted = await insertChunked(
    schema.scrutinGroupResults,
    groupResultRows,
  );
  const votesInserted = await insertChunked(schema.votes, voteRows);

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
      sessionsNew: sessionMap.size,
      scrutinsTotalAvailable: scrutinEntries.length,
      scrutinsInDbBefore: existing.size,
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
