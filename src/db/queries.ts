/**
 * Read-only query helpers used by the web app's server components. Every
 * function here is a fast Turso read — no LLM calls, no heavy work (brief §2).
 */

import { and, desc, eq, inArray, like, sql } from "drizzle-orm";

import { db } from "./client";
import {
  deputies,
  dossierThemes,
  dossiers,
  groups,
  scrutinAi,
  scrutinGroupResults,
  scrutins,
  sessionAi,
  votes,
  type VotePosition,
} from "./schema";

export const PAGE_SIZE = 20;

export interface ScrutinFilter {
  q?: string;
  theme?: string;
  limit?: number;
  offset?: number;
}

function scrutinWhere({ q, theme }: ScrutinFilter) {
  const clauses = [];
  if (q && q.trim()) {
    clauses.push(like(scrutins.titre, `%${q.trim()}%`));
  }
  if (theme) {
    // Scrutins inherit their dossier's themes.
    const dossierIds = db
      .select({ id: dossierThemes.dossierId })
      .from(dossierThemes)
      .where(eq(dossierThemes.theme, theme));
    clauses.push(inArray(scrutins.dossierId, dossierIds));
  }
  return clauses.length ? and(...clauses) : undefined;
}

/** List scrutins, most recent first, with optional title search / theme filter. */
export async function listScrutins(filter: ScrutinFilter = {}) {
  const limit = filter.limit ?? PAGE_SIZE;
  const offset = filter.offset ?? 0;
  const where = scrutinWhere(filter);

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(scrutins)
      .where(where)
      .orderBy(desc(scrutins.date), desc(scrutins.numero))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(scrutins)
      .where(where),
  ]);

  return { rows, total: Number(totalRow[0]?.count ?? 0) };
}

export type ScrutinRow = Awaited<ReturnType<typeof listScrutins>>["rows"][number];

/** All parliamentary groups, largest first. */
export async function getGroups() {
  return db.select().from(groups).orderBy(desc(groups.effectif));
}

export async function getGroupById(id: string) {
  const rows = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Scrutins seen from one group's perspective: the group's majority position and
 * participation rate on each, most recent first.
 */
export async function listScrutinsForGroup(
  groupId: string,
  { limit = PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {},
) {
  const [rows, totalRow] = await Promise.all([
    db
      .select({
        scrutin: scrutins,
        result: scrutinGroupResults,
      })
      .from(scrutinGroupResults)
      .innerJoin(scrutins, eq(scrutins.id, scrutinGroupResults.scrutinId))
      .where(eq(scrutinGroupResults.groupId, groupId))
      .orderBy(desc(scrutins.date), desc(scrutins.numero))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(scrutinGroupResults)
      .where(eq(scrutinGroupResults.groupId, groupId)),
  ]);
  return { rows, total: Number(totalRow[0]?.count ?? 0) };
}

/** Number of scrutins carrying each theme (via their dossier). */
export async function getThemeCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      theme: dossierThemes.theme,
      count: sql<number>`count(distinct ${scrutins.id})`,
    })
    .from(dossierThemes)
    .innerJoin(scrutins, eq(scrutins.dossierId, dossierThemes.dossierId))
    .groupBy(dossierThemes.theme);
  return new Map(rows.map((r) => [r.theme, Number(r.count)]));
}

// --- Single-scrutin detail (used in phase 4) -----------------------------

export async function getScrutinById(id: string) {
  const rows = await db.select().from(scrutins).where(eq(scrutins.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getDossier(id: string) {
  const rows = await db.select().from(dossiers).where(eq(dossiers.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Per-group results for a scrutin, joined with group metadata. */
export async function getScrutinGroupResults(scrutinId: string) {
  return db
    .select({
      group: groups,
      result: scrutinGroupResults,
    })
    .from(scrutinGroupResults)
    .leftJoin(groups, eq(groups.id, scrutinGroupResults.groupId))
    .where(eq(scrutinGroupResults.scrutinId, scrutinId));
}

export interface SeatVote {
  deputyId: string;
  nom: string;
  prenom: string;
  groupId: string | null;
  position: VotePosition;
}

/** Per-deputy votes for a scrutin, joined with deputy identity. */
export async function getScrutinVotes(scrutinId: string): Promise<SeatVote[]> {
  const rows = await db
    .select({
      deputyId: votes.deputyId,
      position: votes.position,
      nom: deputies.nom,
      prenom: deputies.prenom,
      groupId: deputies.groupId,
    })
    .from(votes)
    .leftJoin(deputies, eq(deputies.id, votes.deputyId))
    .where(eq(votes.scrutinId, scrutinId));

  return rows.map((r) => ({
    deputyId: r.deputyId,
    nom: r.nom ?? "",
    prenom: r.prenom ?? "",
    groupId: r.groupId ?? null,
    position: r.position,
  }));
}

export async function getScrutinAi(scrutinId: string) {
  const rows = await db
    .select()
    .from(scrutinAi)
    .where(eq(scrutinAi.scrutinId, scrutinId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSessionAi(sessionId: string) {
  const rows = await db
    .select()
    .from(sessionAi)
    .where(eq(sessionAi.sessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

/** Theme ids attached to a scrutin's dossier. */
export async function getScrutinThemes(dossierId: string | null): Promise<string[]> {
  if (!dossierId) return [];
  const rows = await db
    .select({ theme: dossierThemes.theme })
    .from(dossierThemes)
    .where(eq(dossierThemes.dossierId, dossierId));
  return rows.map((r) => r.theme);
}
