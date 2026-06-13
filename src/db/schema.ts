/**
 * Turso (libSQL / SQLite) schema for Hemicycle, defined with Drizzle ORM.
 *
 * Design notes (see project brief §5):
 * - Raw data tables (`dossiers`, `scrutins`, `groups`, `deputies`, `votes`,
 *   `sessions`) are ingested for *every* public vote of the legislature.
 * - Pre-aggregated per-group results (`scrutinGroupResults`) are stored so the
 *   web app never has to scan the (very large) `votes` table to render a vote.
 * - AI enrichment lives in *separate* tables (`scrutinAi`, `dossierThemes`,
 *   `sessionAi`) so it can be regenerated without touching the raw data, and so
 *   the costly LLM passes only run on the small subset of significant votes.
 *
 * Identifiers reuse the official Assemblée nationale uids (e.g. "VTANR5L17V42",
 * "PA1592", "PO845401") as text primary keys, which makes ingestion idempotent.
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/** Vote outcome of a scrutin. */
export type ScrutinResult = "adopte" | "rejete";
/** Form of a scrutin: solemn votes are the headline ones. */
export type ScrutinForme = "solennel" | "ordinaire";
/** A deputy's position on a given scrutin. */
export type VotePosition = "pour" | "contre" | "abstention" | "non-votant";

/**
 * Legislative files (dossiers législatifs). A dossier groups together the many
 * scrutins (amendments, articles, final vote) that belong to the same text, and
 * is the unit AI themes are attached to.
 */
export const dossiers = sqliteTable("dossiers", {
  id: text("id").primaryKey(),
  titre: text("titre").notNull(),
  // e.g. "projet de loi", "proposition de loi", "motion"...
  type: text("type"),
  // Canonical page on the official Assemblée nationale website.
  url: text("url"),
  // Set once the AI theme tagging has run for this dossier (even if it yielded
  // no themes). Lets the enrichment step skip already-processed dossiers
  // without re-paying. Preserved across ingests (not in the upsert SET clause).
  themesTaggedAt: text("themes_tagged_at"),
});

/** A sitting (séance). One AI session summary is shared by all its scrutins. */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  // ISO date "YYYY-MM-DD", stored as text for cheap chronological sorting.
  date: text("date"),
  numero: integer("numero"),
});

/** Parliamentary groups (groupes parlementaires) — not "parties". */
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  libelle: text("libelle").notNull(),
  // Short label, e.g. "RN", "LFI-NFP", "EPR".
  abrege: text("abrege"),
  // Hex color used for the hemicycle SVG and group badges.
  couleur: text("couleur"),
  // Headcount, used as the denominator for participation rates.
  effectif: integer("effectif").default(0).notNull(),
});

/** Deputies (députés). */
export const deputies = sqliteTable(
  "deputies",
  {
    id: text("id").primaryKey(),
    nom: text("nom").notNull(),
    prenom: text("prenom").notNull(),
    groupId: text("group_id").references(() => groups.id),
  },
  (t) => [index("deputies_group_idx").on(t.groupId)],
);

/**
 * Public votes (scrutins). The pipeline ingests all of them as raw data, but
 * only `solennel` or `is_final` ones get the costly AI explanation/summary.
 */
export const scrutins = sqliteTable(
  "scrutins",
  {
    id: text("id").primaryKey(),
    numero: integer("numero"),
    // ISO date "YYYY-MM-DD".
    date: text("date"),
    titre: text("titre").notNull(),
    // Longer description of what is being voted on.
    objet: text("objet"),
    forme: text("forme").$type<ScrutinForme>().notNull().default("ordinaire"),
    // Raw AN vote-type code: SPO (ordinaire), SPS (solennel), MOC (motion de
    // censure). Kept so AI enrichment can target the significant subset
    // (SPS + MOC + is_final) precisely.
    typeCode: text("type_code"),
    // Whether this is a vote on a whole text (vote sur l'ensemble).
    isFinal: integer("is_final", { mode: "boolean" })
      .notNull()
      .default(false),
    resultat: text("resultat").$type<ScrutinResult>(),
    // Raw aggregate counts as reported by the AN.
    countPour: integer("count_pour").default(0).notNull(),
    countContre: integer("count_contre").default(0).notNull(),
    countAbstention: integer("count_abstention").default(0).notNull(),
    countNonVotant: integer("count_non_votant").default(0).notNull(),
    sessionId: text("session_id").references(() => sessions.id),
    // Parent legislative file; lets us roll amendment votes up to their text.
    // No FK: the referenced dossier may not be present in the dossiers archive.
    dossierId: text("dossier_id"),
    url: text("url"),
  },
  (t) => [
    index("scrutins_date_idx").on(t.date),
    index("scrutins_dossier_idx").on(t.dossierId),
    index("scrutins_session_idx").on(t.sessionId),
    // Used to find the small subset eligible for costly AI enrichment.
    index("scrutins_forme_final_idx").on(t.forme, t.isFinal),
  ],
);

/**
 * Individual deputy votes. This is by far the largest table
 * (~7000 scrutins × ~577 deputies), hence the pre-aggregated results below.
 */
export const votes = sqliteTable(
  "votes",
  {
    scrutinId: text("scrutin_id")
      .notNull()
      .references(() => scrutins.id),
    // No FK to deputies: a vote is an immutable historical fact and may
    // reference a deputy who has since left (and so is absent from the
    // active-deputies dataset). The per-group aggregate counts remain
    // authoritative regardless.
    deputyId: text("deputy_id").notNull(),
    position: text("position").$type<VotePosition>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.scrutinId, t.deputyId] }),
    index("votes_deputy_idx").on(t.deputyId),
  ],
);

/**
 * Pre-aggregated per-group results for a scrutin. Computed by the pipeline so
 * the web app can render the per-group breakdown without scanning `votes`.
 */
export const scrutinGroupResults = sqliteTable(
  "scrutin_group_results",
  {
    scrutinId: text("scrutin_id")
      .notNull()
      .references(() => scrutins.id),
    // No FK to groups: historical ventilations may reference a group that has
    // since been dissolved and is absent from the active-groups dataset.
    groupId: text("group_id").notNull(),
    pour: integer("pour").default(0).notNull(),
    contre: integer("contre").default(0).notNull(),
    abstention: integer("abstention").default(0).notNull(),
    nonVotant: integer("non_votant").default(0).notNull(),
    // Group headcount at the time of the vote (participation denominator).
    effectif: integer("effectif").default(0).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.scrutinId, t.groupId] }),
    index("sgr_group_idx").on(t.groupId),
  ],
);

// ---------------------------------------------------------------------------
// AI enrichment tables (kept separate from raw data — see brief §5/§7).
// ---------------------------------------------------------------------------

/** Costly AI output, only for solemn / final scrutins. */
export const scrutinAi = sqliteTable("scrutin_ai", {
  scrutinId: text("scrutin_id")
    .primaryKey()
    .references(() => scrutins.id),
  // Grounded "what is this vote about" explanation, in French.
  explanation: text("explanation"),
  // Short neutral summary, in French.
  summary: text("summary"),
  generatedAt: text("generated_at").default(sql`CURRENT_TIMESTAMP`),
  model: text("model"),
  // Hash of the source material; lets the pipeline skip unchanged items.
  sourceHash: text("source_hash"),
});

/**
 * Theme tags attached to a *dossier* (not a scrutin). Scrutins inherit the
 * themes of their dossier, which is what makes the theme filter cover the whole
 * corpus cheaply. A dossier can carry several themes.
 */
export const dossierThemes = sqliteTable(
  "dossier_themes",
  {
    dossierId: text("dossier_id")
      .notNull()
      .references(() => dossiers.id),
    // A value from the fixed taxonomy (see src/lib/themes.ts).
    theme: text("theme").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.dossierId, t.theme] }),
    index("dossier_themes_theme_idx").on(t.theme),
  ],
);

/** Costly AI session summary, shared by every scrutin of that session. */
export const sessionAi = sqliteTable("session_ai", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => sessions.id),
  summary: text("summary"),
  generatedAt: text("generated_at").default(sql`CURRENT_TIMESTAMP`),
  model: text("model"),
  sourceHash: text("source_hash"),
});
