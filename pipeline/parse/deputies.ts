/**
 * Parse deputies from the `acteur` entries. A deputy's parliamentary group is
 * the organe referenced by their active "GP" mandate (typeOrgane "GP" with no
 * end date). Deputies with no current group mandate get a null group.
 */

import type { ArchiveEntry } from "../lib/archive";
import { ensureArray } from "../lib/util";

export interface ParsedDeputy {
  id: string;
  nom: string;
  prenom: string;
  groupId: string | null;
}

interface RawMandat {
  typeOrgane?: string;
  dateFin?: string | null;
  organes?: { organeRef?: string | string[] };
}

export interface RawActeur {
  acteur: {
    uid: string | { "#text"?: string };
    etatCivil?: { ident?: { nom?: string; prenom?: string } };
    mandats?: { mandat?: RawMandat | RawMandat[] };
  };
}

/** The acteur uid is sometimes an object ({ "#text": "PA..." }); normalize it. */
function readUid(uid: RawActeur["acteur"]["uid"]): string {
  if (typeof uid === "string") return uid;
  return uid?.["#text"] ?? "";
}

function findActiveGroupId(mandats: RawMandat[]): string | null {
  for (const m of mandats) {
    if (m.typeOrgane !== "GP") continue;
    if (m.dateFin) continue;
    const ref = m.organes?.organeRef;
    const id = Array.isArray(ref) ? ref[0] : ref;
    if (id) return id;
  }
  return null;
}

export function parseDeputies(entries: ArchiveEntry<RawActeur>[]): ParsedDeputy[] {
  const deputies: ParsedDeputy[] = [];
  for (const { data } of entries) {
    const a = data.acteur;
    if (!a) continue;
    const id = readUid(a.uid);
    if (!id) continue;
    const ident = a.etatCivil?.ident ?? {};
    deputies.push({
      id,
      nom: ident.nom ?? "",
      prenom: ident.prenom ?? "",
      groupId: findActiveGroupId(ensureArray(a.mandats?.mandat)),
    });
  }
  return deputies;
}
