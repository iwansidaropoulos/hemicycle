/**
 * Parse legislative files (dossiers) from the dossiers archive. The archive
 * mixes several legislatures, so we keep only the current one. The official URL
 * is built from the dossier's `titreChemin`.
 */

import { LEGISLATURE, officialDossierUrl } from "../config";
import type { ArchiveEntry } from "../lib/archive";

export interface ParsedDossier {
  id: string;
  titre: string;
  type: string | null;
  url: string | null;
}

export interface RawDossier {
  dossierParlementaire?: {
    uid: string;
    legislature?: string;
    titreDossier?: { titre?: string; titreChemin?: string };
    procedureParlementaire?: { libelle?: string };
  };
}

export function parseDossiers(entries: ArchiveEntry<RawDossier>[]): ParsedDossier[] {
  const dossiers: ParsedDossier[] = [];
  for (const { data } of entries) {
    const d = data.dossierParlementaire;
    if (!d) continue;
    if (d.legislature && d.legislature !== String(LEGISLATURE)) continue;
    const chemin = d.titreDossier?.titreChemin;
    dossiers.push({
      id: d.uid,
      titre: d.titreDossier?.titre ?? d.uid,
      type: d.procedureParlementaire?.libelle ?? null,
      url: chemin ? officialDossierUrl(chemin) : null,
    });
  }
  return dossiers;
}
