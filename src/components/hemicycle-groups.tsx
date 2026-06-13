"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { politicalRank } from "@/lib/groups";

/**
 * Interactive hemicycle for the home page: one seat per deputy, grouped into
 * contiguous wedges sized to each group's headcount and ordered left→right by
 * political position. Clicking a group's wedge (or legend chip) opens its page.
 */

export interface HemicycleGroupDatum {
  id: string;
  abrege: string | null;
  libelle: string;
  couleur: string | null;
  effectif: number;
}

interface Seat {
  x: number;
  y: number;
  angle: number;
}

const WIDTH = 760;

/** Lay out N seats across a semicircle, returned ordered left→right. */
function layout(n: number): { seats: Seat[]; height: number; seatRadius: number } {
  const innerRadius = WIDTH * 0.2;
  const outerRadius = WIDTH * 0.47;
  const cx = WIDTH / 2;
  const rows = Math.min(18, Math.max(6, Math.round(n / 38)));
  const radii: number[] = [];
  for (let i = 0; i < rows; i++) {
    radii.push(innerRadius + ((outerRadius - innerRadius) * i) / (rows - 1));
  }
  const totalRadius = radii.reduce((a, b) => a + b, 0);
  const perRow = radii.map((r) => Math.max(1, Math.floor((n * r) / totalRadius)));
  let assigned = perRow.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; assigned < n; i = (i - 1 + rows) % rows) {
    perRow[i]++;
    assigned++;
  }

  const cy = outerRadius + 14;
  const seats: Seat[] = [];
  radii.forEach((r, i) => {
    const count = perRow[i];
    for (let k = 0; k < count; k++) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI * (1 - k / (count - 1));
      seats.push({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle), angle });
    }
  });
  seats.sort((a, b) => b.angle - a.angle); // left → right

  const rowGap = (outerRadius - innerRadius) / (rows - 1);
  return { seats: seats.slice(0, n), height: cy + 18, seatRadius: rowGap * 0.42 };
}

export function HemicycleGroups({ groups }: { groups: HemicycleGroupDatum[] }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  const ordered = [...groups]
    .filter((g) => g.effectif > 0)
    .sort((a, b) => politicalRank(a.abrege) - politicalRank(b.abrege));
  const total = ordered.reduce((s, g) => s + g.effectif, 0);

  // Map each seat (left→right) to a group id.
  const seatGroupId: string[] = [];
  for (const g of ordered) {
    for (let k = 0; k < g.effectif; k++) seatGroupId.push(g.id);
  }
  const byId = new Map(ordered.map((g) => [g.id, g]));
  const { seats, height, seatRadius } = layout(total);

  const go = (id: string) => router.push(`/groupes/${id}`);
  const active = hover ? byId.get(hover) : null;

  return (
    <figure className="space-y-3">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Composition de l'Assemblée par groupe">
        {seats.map((s, i) => {
          const gid = seatGroupId[i];
          const g = byId.get(gid);
          const dim = hover && hover !== gid;
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={seatRadius}
              fill={g?.couleur ?? "#a1a1aa"}
              opacity={dim ? 0.25 : 1}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHover(gid)}
              onMouseLeave={() => setHover(null)}
              onClick={() => go(gid)}
            >
              <title>{g ? `${g.libelle} — ${g.effectif} députés` : ""}</title>
            </circle>
          );
        })}
      </svg>

      <figcaption className="text-center text-sm">
        {active ? (
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {active.libelle} — {active.effectif} députés
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">
            {total} députés · survolez ou cliquez un groupe
          </span>
        )}
      </figcaption>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
        {ordered.map((g) => (
          <button
            key={g.id}
            type="button"
            onMouseEnter={() => setHover(g.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => go(g.id)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: g.couleur ?? "#a1a1aa" }}
            />
            {g.abrege ?? g.libelle}
          </button>
        ))}
      </div>
    </figure>
  );
}
