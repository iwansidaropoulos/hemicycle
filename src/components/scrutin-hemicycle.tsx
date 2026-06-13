"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { VotePosition } from "@/db/schema";
import { formatPercent } from "@/lib/format";
import { politicalRank } from "@/lib/groups";
import { HEMICYCLE_WIDTH, layoutSemicircle } from "@/lib/hemicycle-layout";
import { fr } from "@/lib/i18n";

/**
 * Scrutin hemicycle: the FULL assembly (one seat per deputy, every group at its
 * real size), arranged left→right by political position like the home page.
 * Each seat is colored by how that group voted; seats beyond the expressed
 * votes are shown as "did not vote". Hovering a group highlights it and shows
 * its breakdown; clicking opens the group page.
 */

const POSITION_COLOR: Record<VotePosition, string> = {
  pour: "#16a34a",
  contre: "#dc2626",
  abstention: "#a1a1aa",
  "non-votant": "#d4d4d8",
};

export interface ScrutinHemicycleGroup {
  id: string;
  abrege: string | null;
  libelle: string;
  couleur: string | null;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  effectif: number;
}

interface SeatMeta {
  groupId: string;
  color: string;
}

export function ScrutinHemicycle({ groups }: { groups: ScrutinHemicycleGroup[] }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  const ordered = [...groups]
    .filter((g) => g.effectif > 0 || g.pour + g.contre + g.abstention + g.nonVotant > 0)
    .sort((a, b) => politicalRank(a.abrege) - politicalRank(b.abrege));

  // Build the per-seat color/group list, group by group, left→right. Each
  // group gets one seat per member (its size); the seats beyond the expressed
  // votes (pour/contre/abstention) are the non-voting/absent ones. We do NOT
  // add the raw nonVotant count on top — the remainder already represents it,
  // and the AN per-group counts don't always reconcile with the headcount.
  const seatMeta: SeatMeta[] = [];
  for (const g of ordered) {
    const expressed = g.pour + g.contre + g.abstention;
    const size = Math.max(g.effectif, expressed);
    const push = (pos: VotePosition, count: number) => {
      for (let k = 0; k < count; k++) {
        seatMeta.push({ groupId: g.id, color: POSITION_COLOR[pos] });
      }
    };
    push("pour", g.pour);
    push("abstention", g.abstention);
    push("contre", g.contre);
    push("non-votant", Math.max(0, size - expressed));
  }

  const total = seatMeta.length;
  const byId = new Map(ordered.map((g) => [g.id, g]));
  const { seats, height, seatRadius } = layoutSemicircle(total);
  const active = hover ? byId.get(hover) : null;
  const go = (id: string) => router.push(`/groupes/${id}`);

  const legend: Array<[VotePosition, string]> = [
    ["pour", fr.positions.pour],
    ["contre", fr.positions.contre],
    ["abstention", fr.positions.abstention],
    ["non-votant", fr.positions["non-votant"]],
  ];

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${HEMICYCLE_WIDTH} ${height}`}
        className="w-full"
        role="img"
        aria-label={fr.detail.hemicycle}
      >
        {seats.map((s, i) => {
          const meta = seatMeta[i];
          if (!meta) return null;
          const dim = hover && hover !== meta.groupId;
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={seatRadius}
              fill={meta.color}
              opacity={dim ? 0.25 : 1}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHover(meta.groupId)}
              onMouseLeave={() => setHover(null)}
              onClick={() => go(meta.groupId)}
            />
          );
        })}
      </svg>

      <figcaption className="text-center text-sm">
        {active ? (
          <span className="text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">{active.libelle}</span> —{" "}
            <span className="text-emerald-700 dark:text-emerald-400">{active.pour} pour</span>,{" "}
            <span className="text-rose-700 dark:text-rose-400">{active.contre} contre</span>,{" "}
            {active.abstention} abst. ·{" "}
            {formatPercent(
              active.effectif > 0
                ? (active.pour + active.contre + active.abstention) / active.effectif
                : 0,
            )}{" "}
            {fr.groups.participation}
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">
            {total} sièges · survolez un groupe
          </span>
        )}
      </figcaption>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {legend.map(([pos, label]) => (
          <span key={pos} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: POSITION_COLOR[pos] }}
            />
            {label}
          </span>
        ))}
      </div>
    </figure>
  );
}
