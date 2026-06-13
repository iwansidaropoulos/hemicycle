import Link from "next/link";
import { notFound } from "next/navigation";

import { GroupDot, PositionBadge, ResultBadge } from "@/components/badges";
import { Pagination } from "@/components/pagination";
import {
  getGroupById,
  listScrutinsForGroup,
  PAGE_SIZE,
  type GroupSort,
} from "@/db/queries";
import { capitalizeFirst, formatDate, formatPercent, groupStance } from "@/lib/format";
import { officialGroupUrl } from "@/lib/groups";
import { fr } from "@/lib/i18n";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; tri?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam, tri } = await searchParams;
  const group = await getGroupById(id);
  if (!group) notFound();

  const sort: GroupSort = tri === "date" ? "date" : "participation";
  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, total } = await listScrutinsForGroup(id, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sort,
  });
  const officialUrl = officialGroupUrl(group.libelle);

  const tab = (key: GroupSort, label: string) => {
    const active = sort === key;
    return (
      <Link
        href={`/groupes/${id}${key === "participation" ? "" : "?tri=date"}`}
        className={`rounded-md px-3 py-1.5 text-sm ${
          active
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-5">
      <Link
        href="/groupes"
        className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← {fr.groups.title}
      </Link>

      <div className="flex items-center gap-3">
        <GroupDot couleur={group.couleur} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {group.libelle}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {group.abrege ? `${group.abrege} · ` : ""}
            {group.effectif} {fr.groups.members}
            {officialUrl && (
              <>
                {" · "}
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline dark:text-blue-400"
                >
                  {fr.groups.officialPage}
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-zinc-400">
          {fr.groups.sortBy}
        </span>
        {tab("participation", fr.groups.sortParticipation)}
        {tab("date", fr.groups.sortDate)}
      </div>

      <div className="space-y-3">
        {rows.map(({ scrutin, result }) => {
          const { position, participation } = groupStance(result);
          return (
            <Link
              key={scrutin.id}
              href={`/scrutins/${scrutin.id}`}
              className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{formatDate(scrutin.date)}</span>
                  <span aria-hidden>·</span>
                  <span>n° {scrutin.numero}</span>
                  <ResultBadge result={scrutin.resultat} />
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-900 line-clamp-2 dark:text-zinc-100">
                  {capitalizeFirst(scrutin.titre)}
                </p>
                <div className="mt-2">
                  <PositionBadge position={position} />
                </div>
              </div>
              {/* Participation, emphasized */}
              <div className="shrink-0 text-right">
                <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatPercent(participation)}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                  {fr.groups.participation}
                </div>
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
        params={{ tri: sort === "date" ? "date" : undefined }}
      />
    </div>
  );
}
