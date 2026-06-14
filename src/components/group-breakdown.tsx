import { GroupDot } from "@/components/badges";
import type { SeatVote } from "@/db/queries";
import type { groups as groupsTable, scrutinGroupResults } from "@/db/schema";
import type { VotePosition } from "@/db/schema";
import { formatPercent, groupStance } from "@/lib/format";
import { fr } from "@/lib/i18n";

type GroupRow = typeof groupsTable.$inferSelect;
type ResultRow = typeof scrutinGroupResults.$inferSelect;

// Only the expressed votes are shown in the bar (one grey = abstention).
// Non-voting/absent isn't a segment — it's conveyed by the participation %.
const SEGMENTS: Array<{ key: keyof Pick<ResultRow, "pour" | "contre" | "abstention">; color: string }> = [
  { key: "pour", color: "#16a34a" },
  { key: "abstention", color: "#a1a1aa" },
  { key: "contre", color: "#dc2626" },
];

const POSITION_GROUPS: Array<{ pos: VotePosition; label: string }> = [
  { pos: "pour", label: fr.positions.pour },
  { pos: "contre", label: fr.positions.contre },
  { pos: "abstention", label: fr.positions.abstention },
  { pos: "non-votant", label: fr.positions["non-votant"] },
];

/** Per-group vote breakdown with a stacked bar, participation, and per-deputy detail. */
export function GroupBreakdown({
  results,
  votesByGroup,
}: {
  results: Array<{ group: GroupRow | null; result: ResultRow }>;
  votesByGroup: Map<string, SeatVote[]>;
}) {
  return (
    <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {results.map(({ group, result }) => {
        const { participation } = groupStance(result);
        const total = result.pour + result.contre + result.abstention;
        const deputies = votesByGroup.get(result.groupId) ?? [];
        return (
          <details key={result.groupId} className="group p-4">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <GroupDot couleur={group?.couleur ?? null} />
              <span className="w-28 shrink-0 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {group?.abrege ?? group?.libelle ?? result.groupId}
              </span>
              <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                {SEGMENTS.map((seg) => {
                  const v = result[seg.key];
                  if (!v || total === 0) return null;
                  return (
                    <span
                      key={seg.key}
                      style={{ width: `${(v / total) * 100}%`, backgroundColor: seg.color }}
                      title={`${seg.key}: ${v}`}
                    />
                  );
                })}
              </span>
              <span className="w-32 shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
                {result.pour}/{result.contre}/{result.abstention} ·{" "}
                {formatPercent(participation)}
              </span>
            </summary>

            {deputies.length > 0 && (
              <div className="mt-3 space-y-2 pl-6 text-xs">
                {POSITION_GROUPS.map(({ pos, label }) => {
                  const list = deputies.filter((d) => d.position === pos);
                  if (list.length === 0) return null;
                  return (
                    <div key={pos}>
                      <p className="font-medium text-zinc-600 dark:text-zinc-300">
                        {label} ({list.length})
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        {list
                          .map((d) => `${d.prenom} ${d.nom}`.trim())
                          .filter(Boolean)
                          .sort((a, b) => a.localeCompare(b, "fr"))
                          .join(", ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
