import Link from "next/link";

import { ResultBadge, FormeBadge } from "@/components/badges";
import type { ScrutinRow } from "@/db/queries";
import { formatDate } from "@/lib/format";
import { fr } from "@/lib/i18n";

/** A scrutin summary row used in all list views. */
export function ScrutinCard({ scrutin }: { scrutin: ScrutinRow }) {
  const votants =
    scrutin.countPour + scrutin.countContre + scrutin.countAbstention;
  return (
    <Link
      href={`/scrutins/${scrutin.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>{formatDate(scrutin.date)}</span>
        <span aria-hidden>·</span>
        <span>n° {scrutin.numero}</span>
        <FormeBadge forme={scrutin.forme} typeCode={scrutin.typeCode} />
      </div>
      <p className="mt-1 text-sm font-medium text-zinc-900 line-clamp-2">
        {scrutin.titre}
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
        <ResultBadge result={scrutin.resultat} />
        <span className="text-emerald-700">{scrutin.countPour} pour</span>
        <span className="text-rose-700">{scrutin.countContre} contre</span>
        <span>{scrutin.countAbstention} abst.</span>
        <span className="text-zinc-400">
          {votants} {fr.scrutins.votants}
        </span>
      </div>
    </Link>
  );
}
