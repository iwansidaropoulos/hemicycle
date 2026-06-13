import Link from "next/link";
import { notFound } from "next/navigation";

import { AiBlock } from "@/components/ai-block";
import { FormeBadge, ResultBadge } from "@/components/badges";
import { GroupBreakdown } from "@/components/group-breakdown";
import {
  ScrutinHemicycle,
  type ScrutinHemicycleGroup,
} from "@/components/scrutin-hemicycle";
import {
  getDossier,
  getScrutinAi,
  getScrutinById,
  getScrutinGroupResults,
  getScrutinThemes,
  getScrutinVotes,
  getSessionAi,
  type SeatVote,
} from "@/db/queries";
import { capitalizeFirst, formatDate } from "@/lib/format";
import { fr } from "@/lib/i18n";
import { themeLabel } from "@/lib/themes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scrutin = await getScrutinById(id);
  return { title: scrutin ? `${scrutin.titre} — ${fr.appName}` : fr.appName };
}

export default async function ScrutinDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scrutin = await getScrutinById(id);
  if (!scrutin) notFound();

  const [groupResults, votes, ai, themes, dossier, sessionAi] =
    await Promise.all([
      getScrutinGroupResults(id),
      getScrutinVotes(id),
      getScrutinAi(id),
      getScrutinThemes(scrutin.dossierId),
      scrutin.dossierId ? getDossier(scrutin.dossierId) : Promise.resolve(null),
      scrutin.sessionId
        ? getSessionAi(scrutin.sessionId)
        : Promise.resolve(null),
    ]);

  // Largest groups first for the breakdown table.
  const ordered = [...groupResults].sort(
    (a, b) => (b.group?.effectif ?? 0) - (a.group?.effectif ?? 0),
  );
  // The hemicycle re-orders these left→right by political position itself.
  const hemicycleGroups: ScrutinHemicycleGroup[] = ordered.map(
    ({ group, result }) => ({
      id: group?.id ?? result.groupId,
      abrege: group?.abrege ?? null,
      libelle: group?.libelle ?? result.groupId,
      couleur: group?.couleur ?? null,
      pour: result.pour,
      contre: result.contre,
      abstention: result.abstention,
      nonVotant: result.nonVotant,
      effectif: result.effectif,
    }),
  );

  const votesByGroup = new Map<string, SeatVote[]>();
  for (const v of votes) {
    if (!v.groupId) continue;
    const list = votesByGroup.get(v.groupId) ?? [];
    list.push(v);
    votesByGroup.set(v.groupId, list);
  }

  const votants =
    scrutin.countPour + scrutin.countContre + scrutin.countAbstention;

  return (
    <article className="space-y-6">
      <Link href="/scrutins" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        {fr.detail.backToList}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{formatDate(scrutin.date)}</span>
          <span aria-hidden>·</span>
          <span>n° {scrutin.numero}</span>
          <FormeBadge forme={scrutin.forme} typeCode={scrutin.typeCode} />
          <ResultBadge result={scrutin.resultat} />
        </div>
        <h1 className="text-xl font-semibold leading-snug tracking-tight">
          {capitalizeFirst(scrutin.titre)}
        </h1>

        {themes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {themes.map((t) => (
              <Link
                key={t}
                href={`/themes/${t}`}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {themeLabel(t)}
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <a
            href={scrutin.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 hover:underline dark:text-blue-400"
          >
            {fr.detail.officialLink}
          </a>
          {dossier?.url && (
            <a
              href={dossier.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 hover:underline dark:text-blue-400"
            >
              {fr.detail.dossier}
            </a>
          )}
        </div>
      </header>

      {/* Overall counts */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            [fr.positions.pour, scrutin.countPour, "text-emerald-700 dark:text-emerald-400"],
            [fr.positions.contre, scrutin.countContre, "text-rose-700 dark:text-rose-400"],
            [fr.positions.abstention, scrutin.countAbstention, "text-zinc-700 dark:text-zinc-300"],
            [fr.scrutins.votants, votants, "text-zinc-500 dark:text-zinc-400"],
          ] as const
        ).map(([label, value, cls]) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
          </div>
        ))}
      </section>

      <AiBlock title={fr.ai.explanation} content={ai?.explanation} />

      {/* Hemicycle */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {fr.detail.hemicycle}
        </h2>
        <ScrutinHemicycle groups={hemicycleGroups} />
      </section>

      {/* Per-group breakdown */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {fr.detail.byGroup}
        </h2>
        <GroupBreakdown results={ordered} votesByGroup={votesByGroup} />
      </section>

      <AiBlock title={fr.ai.sessionSummary} content={sessionAi?.summary} />
    </article>
  );
}
