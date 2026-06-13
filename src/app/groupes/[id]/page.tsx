import Link from "next/link";
import { notFound } from "next/navigation";

import { GroupDot, PositionBadge, ResultBadge } from "@/components/badges";
import { Pagination } from "@/components/pagination";
import {
  getGroupById,
  listScrutinsForGroup,
  PAGE_SIZE,
} from "@/db/queries";
import { formatDate, formatPercent, groupStance } from "@/lib/format";
import { fr } from "@/lib/i18n";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const group = await getGroupById(id);
  if (!group) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, total } = await listScrutinsForGroup(id, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div className="space-y-5">
      <Link href="/groupes" className="text-sm text-zinc-500 hover:underline">
        ← {fr.groups.title}
      </Link>

      <div className="flex items-center gap-3">
        <GroupDot couleur={group.couleur} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {group.libelle}
          </h1>
          <p className="text-sm text-zinc-500">
            {group.abrege ? `${group.abrege} · ` : ""}
            {group.effectif} {fr.groups.members}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(({ scrutin, result }) => {
          const { position, participation } = groupStance(result);
          return (
            <Link
              key={scrutin.id}
              href={`/scrutins/${scrutin.id}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{formatDate(scrutin.date)}</span>
                <span aria-hidden>·</span>
                <span>n° {scrutin.numero}</span>
                <ResultBadge result={scrutin.resultat} />
              </div>
              <p className="mt-1 text-sm font-medium text-zinc-900 line-clamp-2">
                {scrutin.titre}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
                <PositionBadge position={position} />
                <span className="text-zinc-400">
                  {formatPercent(participation)} {fr.groups.participation}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        basePath={`/groupes/${id}`}
      />
    </div>
  );
}
