/**
 * Parliamentary-group presentation helpers: left→right political ordering (for
 * the hemicycle) and the official Assemblée nationale group-page URL.
 */

/**
 * Left-to-right political order of the 17th-legislature groups, by abbreviation.
 * Used to place groups realistically in the hemicycle (left on the left). Groups
 * not listed are placed after these, in their incoming order.
 */
const POLITICAL_ORDER = [
  "LFI-NFP",
  "GDR",
  "EcoS",
  "SOC",
  "LIOT",
  "DEM",
  "EPR",
  "HOR",
  "DR",
  "UDR",
  "RN",
];

/** Sort key for a group abbreviation (lower = further left). Unknown → end. */
export function politicalRank(abrege: string | null): number {
  if (!abrege) return POLITICAL_ORDER.length + 1;
  const i = POLITICAL_ORDER.indexOf(abrege);
  return i === -1 ? POLITICAL_ORDER.length : i;
}

/** Slugify a group name the way the AN website does ("Rassemblement National" → "rassemblement-national"). */
function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Official AN page for a parliamentary group, or null if the name is missing. */
export function officialGroupUrl(libelle: string | null): string | null {
  if (!libelle) return null;
  return `https://www2.assemblee-nationale.fr/17/les-groupes-politiques/${slugify(libelle)}`;
}
