import { fr } from "@/lib/i18n";
import type { ScrutinForme, ScrutinResult, VotePosition } from "@/db/schema";

/** Adopté / Rejeté pill. */
export function ResultBadge({ result }: { result: ScrutinResult | null }) {
  if (!result) return null;
  const adopted = result === "adopte";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        adopted
          ? "bg-emerald-100 text-emerald-800"
          : "bg-rose-100 text-rose-800"
      }`}
    >
      {fr.result[result]}
    </span>
  );
}

/** Solennel / motion de censure marker (ordinary votes get no badge). */
export function FormeBadge({
  forme,
  typeCode,
}: {
  forme: ScrutinForme;
  typeCode?: string | null;
}) {
  if (typeCode === "MOC") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        {fr.forme.motion}
      </span>
    );
  }
  if (forme !== "solennel") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
      {fr.forme.solennel}
    </span>
  );
}

const POSITION_STYLES: Record<VotePosition | "mixte", string> = {
  pour: "bg-emerald-100 text-emerald-800",
  contre: "bg-rose-100 text-rose-800",
  abstention: "bg-zinc-200 text-zinc-700",
  "non-votant": "bg-zinc-100 text-zinc-500",
  mixte: "bg-zinc-200 text-zinc-700",
};

const POSITION_LABELS: Record<VotePosition | "mixte", string> = {
  pour: fr.groups.votedFor,
  contre: fr.groups.votedAgainst,
  abstention: fr.groups.abstained,
  "non-votant": fr.groups.absent,
  mixte: fr.groups.mixed,
};

/** A group's stance on a scrutin. */
export function PositionBadge({ position }: { position: VotePosition | "mixte" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${POSITION_STYLES[position]}`}
    >
      {POSITION_LABELS[position]}
    </span>
  );
}

/** Small colored dot for a parliamentary group. */
export function GroupDot({ couleur }: { couleur: string | null }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
      style={{ backgroundColor: couleur ?? "#a1a1aa" }}
    />
  );
}
