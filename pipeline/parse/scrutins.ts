/**
 * Parse a single scrutin into the rows it produces:
 *  - one `scrutins` row (metadata + overall counts + session/dossier links),
 *  - one `scrutin_group_results` row per group (pre-aggregated counts), and
 *  - one `votes` row per deputy whose nominal position is published.
 *
 * Per-group counts come from `decompteVoix`; per-deputy positions from
 * `decompteNominatif` (which is absent on scrutins published as counts only).
 */

import { officialScrutinUrl } from "../config";
import type {
  ScrutinForme,
  ScrutinResult,
  VotePosition,
} from "../../src/db/schema";
import { ensureArray, toInt } from "../lib/util";

export interface ParsedScrutin {
  scrutin: {
    id: string;
    numero: number;
    date: string | null;
    titre: string;
    objet: string | null;
    forme: ScrutinForme;
    typeCode: string | null;
    isFinal: boolean;
    resultat: ScrutinResult | null;
    countPour: number;
    countContre: number;
    countAbstention: number;
    countNonVotant: number;
    sessionId: string | null;
    dossierId: string | null;
    url: string;
  };
  session: { id: string; date: string | null } | null;
  groupResults: Array<{
    scrutinId: string;
    groupId: string;
    pour: number;
    contre: number;
    abstention: number;
    nonVotant: number;
    effectif: number;
  }>;
  votes: Array<{
    scrutinId: string;
    deputyId: string;
    position: VotePosition;
  }>;
}

interface RawDecompte {
  pour?: string;
  contre?: string;
  abstentions?: string;
  nonVotants?: string;
  nonVotantsVolontaires?: string;
}

interface RawVotant {
  acteurRef?: string;
}
interface RawBucket {
  votant?: RawVotant | RawVotant[];
}
interface RawGroupe {
  organeRef?: string;
  nombreMembresGroupe?: string;
  vote?: {
    decompteVoix?: RawDecompte;
    decompteNominatif?: {
      pours?: RawBucket | null;
      contres?: RawBucket | null;
      abstentions?: RawBucket | null;
      nonVotants?: RawBucket | null;
    };
  };
}

export interface RawScrutinFile {
  scrutin: {
    uid: string;
    numero?: string;
    dateScrutin?: string;
    seanceRef?: string;
    titre?: string;
    typeVote?: { codeTypeVote?: string };
    sort?: { code?: string };
    objet?: {
      libelle?: string;
      dossierLegislatif?: { dossierRef?: string } | null;
    };
    syntheseVote?: { decompte?: RawDecompte };
    ventilationVotes?: {
      organe?: { groupes?: { groupe?: RawGroupe | RawGroupe[] } };
    };
  };
}

function mapResult(code: string | undefined): ScrutinResult | null {
  if (!code) return null;
  // The AN uses accented "adopté"/"rejeté"; store ascii enum values.
  return code.startsWith("adopt") ? "adopte" : "rejete";
}

/** A scrutin is "final" when it is the vote on the whole text. */
function detectIsFinal(titre: string, objet: string): boolean {
  return `${titre} ${objet}`.toLowerCase().includes("ensemble");
}

function collectVotes(
  scrutinId: string,
  bucket: RawBucket | null | undefined,
  position: VotePosition,
  out: ParsedScrutin["votes"],
) {
  if (!bucket) return;
  for (const v of ensureArray(bucket.votant)) {
    if (v?.acteurRef) {
      out.push({ scrutinId, deputyId: v.acteurRef, position });
    }
  }
}

export function parseScrutin(raw: RawScrutinFile): ParsedScrutin {
  const s = raw.scrutin;
  const id = s.uid;
  const titre = s.titre ?? "";
  const objet = s.objet?.libelle ?? null;
  const code = s.typeVote?.codeTypeVote ?? null;
  const decompte = s.syntheseVote?.decompte ?? {};
  const sessionId = s.seanceRef ?? null;
  const date = s.dateScrutin ?? null;

  const scrutin: ParsedScrutin["scrutin"] = {
    id,
    numero: toInt(s.numero),
    date,
    titre,
    objet,
    forme: code === "SPS" ? "solennel" : "ordinaire",
    typeCode: code,
    isFinal: detectIsFinal(titre, objet ?? ""),
    resultat: mapResult(s.sort?.code),
    countPour: toInt(decompte.pour),
    countContre: toInt(decompte.contre),
    countAbstention: toInt(decompte.abstentions),
    countNonVotant:
      toInt(decompte.nonVotants) + toInt(decompte.nonVotantsVolontaires),
    sessionId,
    dossierId: s.objet?.dossierLegislatif?.dossierRef ?? null,
    url: officialScrutinUrl(toInt(s.numero)),
  };

  const groupResults: ParsedScrutin["groupResults"] = [];
  const votes: ParsedScrutin["votes"] = [];

  const groupes = ensureArray(
    s.ventilationVotes?.organe?.groupes?.groupe,
  );
  for (const g of groupes) {
    if (!g.organeRef) continue;
    const dv = g.vote?.decompteVoix ?? {};
    groupResults.push({
      scrutinId: id,
      groupId: g.organeRef,
      pour: toInt(dv.pour),
      contre: toInt(dv.contre),
      abstention: toInt(dv.abstentions),
      nonVotant: toInt(dv.nonVotants) + toInt(dv.nonVotantsVolontaires),
      effectif: toInt(g.nombreMembresGroupe),
    });

    const dn = g.vote?.decompteNominatif;
    if (dn) {
      collectVotes(id, dn.pours, "pour", votes);
      collectVotes(id, dn.contres, "contre", votes);
      collectVotes(id, dn.abstentions, "abstention", votes);
      collectVotes(id, dn.nonVotants, "non-votant", votes);
    }
  }

  const session = sessionId ? { id: sessionId, date } : null;

  return { scrutin, session, groupResults, votes };
}
