/**
 * Pipeline configuration: which legislature to ingest and where the official
 * open-data archives live.
 *
 * Rather than hardcoding fragile deep links scattered through the code, the
 * dataset URLs are derived from the stable Assemblée nationale open-data
 * repository layout and the single `LEGISLATURE` constant — moving to the next
 * legislature is a one-line change here (brief §4).
 */

/** Current legislature being tracked. */
export const LEGISLATURE = 17;

const REPO_BASE = "https://data.assemblee-nationale.fr/static/openData/repository";

/** Public, stable URLs of the JSON archives for the current legislature. */
export const DATASETS = {
  // All public votes (scrutins) of the legislature.
  scrutins: `${REPO_BASE}/${LEGISLATURE}/loi/scrutins/Scrutins.json.zip`,
  // Legislative files (dossiers législatifs).
  dossiers: `${REPO_BASE}/${LEGISLATURE}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`,
  // Active deputies with their active mandates and the organes (incl. groups).
  acteurs: `${REPO_BASE}/${LEGISLATURE}/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip`,
} as const;

/** Build the official website URL for a scrutin (the "lien officiel"). */
export function officialScrutinUrl(numero: number | string): string {
  return `https://www.assemblee-nationale.fr/dyn/${LEGISLATURE}/scrutins/${numero}`;
}

/** Build the official website URL for a dossier. */
export function officialDossierUrl(titreChemin: string): string {
  return `https://www.assemblee-nationale.fr/dyn/${LEGISLATURE}/dossiers/${titreChemin}`;
}
