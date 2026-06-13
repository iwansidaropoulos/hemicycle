import Link from "next/link";

import { GroupDot } from "@/components/badges";
import { getGroups } from "@/db/queries";
import { fr } from "@/lib/i18n";

export const metadata = { title: `${fr.groups.title} — ${fr.appName}` };
export const revalidate = 3600;

export default async function GroupsPage() {
  const groups = await getGroups();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        {fr.groups.title}
      </h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/groupes/${g.id}`}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
          >
            <GroupDot couleur={g.couleur} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">
                {g.libelle}
              </p>
              <p className="text-xs text-zinc-500">
                {g.abrege ? `${g.abrege} · ` : ""}
                {g.effectif} {fr.groups.members}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
