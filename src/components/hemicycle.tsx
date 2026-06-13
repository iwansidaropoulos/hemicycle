import type { VotePosition } from "@/db/schema";
import { fr } from "@/lib/i18n";

/**
 * Semicircle hemicycle: one seat per deputy, colored by vote position and
 * clustered by parliamentary group (brief §8).
 *
 * Seats are derived from the pre-aggregated per-group counts (which exist for
 * every scrutin), so the chart renders even when individual nominal votes are
 * not published. Groups are laid out left→right; within a group, seats are
 * grouped by position so each group reads as a contiguous wedge.
 */

const POSITION_COLOR: Record<VotePosition, string> = {
  pour: "#16a34a",
  contre: "#dc2626",
  abstention: "#a1a1aa",
  "non-votant": "#e4e4e7",
};

const POSITION_ORDER: VotePosition[] = [
  "pour",
  "abstention",
  "contre",
  "non-votant",
];

export interface HemicycleGroup {
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
}

interface Seat {
  x: number;
  y: number;
  color: string;
}

/** Build the ordered list of seat colors from per-group counts. */
function seatColors(groups: HemicycleGroup[]): string[] {
  const colors: string[] = [];
  for (const g of groups) {
    const counts: Record<VotePosition, number> = {
      pour: g.pour,
      abstention: g.abstention,
      contre: g.contre,
      "non-votant": g.nonVotant,
    };
    for (const pos of POSITION_ORDER) {
      for (let i = 0; i < counts[pos]; i++) colors.push(POSITION_COLOR[pos]);
    }
  }
  return colors;
}

/** Lay out N seats across a semicircle and return their coordinates. */
function layoutSeats(n: number, colors: string[]): { seats: Seat[]; width: number; height: number } {
  const width = 760;
  const innerRadius = width * 0.18;
  const outerRadius = width * 0.46;
  const cx = width / 2;
  const cy = outerRadius + 12;

  const rows = Math.min(16, Math.max(6, Math.round(n / 45)));
  const radii: number[] = [];
  for (let i = 0; i < rows; i++) {
    radii.push(innerRadius + ((outerRadius - innerRadius) * i) / (rows - 1));
  }
  const totalRadius = radii.reduce((a, b) => a + b, 0);

  // Seats per row proportional to radius; fix rounding on the outer rows.
  const perRow = radii.map((r) => Math.max(1, Math.floor((n * r) / totalRadius)));
  let assigned = perRow.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; assigned < n; i = (i - 1 + rows) % rows) {
    perRow[i]++;
    assigned++;
  }

  // Build seats row by row, tagging each with its angle for left→right ordering.
  const tagged: Array<{ x: number; y: number; angle: number }> = [];
  radii.forEach((r, i) => {
    const count = perRow[i];
    for (let k = 0; k < count; k++) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI * (1 - k / (count - 1));
      tagged.push({
        x: cx + r * Math.cos(angle),
        y: cy - r * Math.sin(angle),
        angle,
      });
    }
  });
  // Order left→right (angle PI → 0) so groups form contiguous wedges.
  tagged.sort((a, b) => b.angle - a.angle);

  const seats: Seat[] = tagged
    .slice(0, colors.length)
    .map((t, i) => ({ x: t.x, y: t.y, color: colors[i] }));

  return { seats, width, height: cy + 16 };
}

export function Hemicycle({ groups }: { groups: HemicycleGroup[] }) {
  const colors = seatColors(groups);
  if (colors.length === 0) return null;
  const { seats, width, height } = layoutSeats(colors.length, colors);
  const seatRadius = Math.max(2.5, (width / colors.length) * 0.9);

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={fr.detail.hemicycle}
      >
        {seats.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={seatRadius} fill={s.color} />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {(
          [
            ["pour", fr.positions.pour],
            ["contre", fr.positions.contre],
            ["abstention", fr.positions.abstention],
            ["non-votant", fr.positions["non-votant"]],
          ] as const
        ).map(([pos, label]) => (
          <span key={pos} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: POSITION_COLOR[pos] }}
            />
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
