/**
 * Parse parliamentary groups (groupes politiques) from the `organe` entries of
 * the acteurs/organes archive. We keep only active groups (codeType "GP",
 * no end date) of the current legislature. `effectif` (headcount) is filled in
 * later from the deputies, so it is omitted here.
 */

import { LEGISLATURE } from "../config";
import type { ArchiveEntry } from "../lib/archive";

export interface ParsedGroup {
  id: string;
  libelle: string;
  abrege: string | null;
  couleur: string | null;
}

export interface RawOrgane {
  organe: {
    uid: string;
    codeType?: string;
    libelle?: string;
    libelleAbrege?: string;
    couleurAssociee?: string;
    legislature?: string;
    viMoDe?: { dateFin?: string | null };
  };
}

export function parseGroups(entries: ArchiveEntry<RawOrgane>[]): ParsedGroup[] {
  const groups: ParsedGroup[] = [];
  for (const { data } of entries) {
    const o = data.organe;
    if (!o || o.codeType !== "GP") continue;
    // Only active groups of the current legislature.
    if (o.viMoDe?.dateFin) continue;
    if (o.legislature && o.legislature !== String(LEGISLATURE)) continue;
    groups.push({
      id: o.uid,
      libelle: o.libelle ?? o.uid,
      abrege: o.libelleAbrege ?? null,
      couleur: o.couleurAssociee ?? null,
    });
  }
  return groups;
}
