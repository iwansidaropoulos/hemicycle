/**
 * Loads the verbatim debate records (syceron XML archive) once per run and
 * indexes them by séance reference, so both the scrutin-explanation and the
 * session-summary steps can ground themselves in the official debate text
 * (Assemblée nationale open data) without re-downloading.
 */

import { unzipSync } from "fflate";

import { DATASETS } from "../config";
import { download } from "./archive";
import {
  parseInterventions,
  parseSeanceRef,
  type Intervention,
} from "../parse/comptes-rendus";

let memo: Map<string, Uint8Array> | null = null;

/** Download + index the debate records by séance reference (memoized). */
export async function loadComptesRendus(): Promise<Map<string, Uint8Array>> {
  if (memo) return memo;
  const files = unzipSync(await download(DATASETS.comptesRendus));
  const decoder = new TextDecoder("utf-8");
  const index = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.endsWith(".xml") || bytes.length === 0) continue;
    // The séance reference sits near the top of each file.
    const head = decoder.decode(bytes.subarray(0, 4000));
    const ref = parseSeanceRef(head);
    if (ref) index.set(ref, bytes);
  }
  memo = index;
  return index;
}

/** Parsed interventions for one séance, or null if no record exists. */
export function interventionsForSeance(
  index: Map<string, Uint8Array>,
  seanceRef: string,
): Intervention[] | null {
  const bytes = index.get(seanceRef);
  if (!bytes) return null;
  return parseInterventions(new TextDecoder("utf-8").decode(bytes));
}
