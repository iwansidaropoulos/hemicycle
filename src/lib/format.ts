/**
 * Small presentation helpers (French formatting, vote aggregates).
 */

import type { VotePosition } from "@/db/schema";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Format an ISO date ("YYYY-MM-DD") as a French long date. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  // Parse as UTC to avoid timezone drift on date-only values.
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export interface GroupTally {
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  effectif: number;
}

/** A group's dominant position on a scrutin, plus its participation rate. */
export function groupStance(t: GroupTally): {
  position: VotePosition | "mixte";
  participation: number;
} {
  const expressed = t.pour + t.contre + t.abstention;
  const participation = t.effectif > 0 ? expressed / t.effectif : 0;
  const max = Math.max(t.pour, t.contre, t.abstention);
  let position: VotePosition | "mixte" = "mixte";
  if (max === 0) position = "non-votant";
  else if (max === t.pour) position = "pour";
  else if (max === t.contre) position = "contre";
  else if (max === t.abstention) position = "abstention";
  return { position, participation };
}

/** Format a 0..1 ratio as a French percentage (e.g. "87 %"). */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/**
 * Capitalize the first letter of a scrutin title. The Assemblée nationale
 * stores titles lowercased (e.g. "l'ensemble du projet de loi…"); we keep that
 * phrasing but capitalize the first visible letter ("L'ensemble du projet…").
 */
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase("fr-FR") + text.slice(1);
}
