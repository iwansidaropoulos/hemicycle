import Link from "next/link";

import { ScrutinCard } from "@/components/scrutin-card";
import { listScrutins } from "@/db/queries";
import { fr } from "@/lib/i18n";

export const revalidate = 1800;

export default async function Home() {
  const { rows } = await listScrutins({ limit: 8 });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{fr.tagline}</h1>
        <p className="max-w-2xl text-zinc-600">{fr.home.intro}</p>
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-400">{fr.home.comingSoon}</p>
      ) : (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-zinc-800">
              {fr.scrutins.title}
            </h2>
            <Link
              href="/scrutins"
              className="text-sm text-zinc-500 hover:underline"
            >
              {fr.scrutins.title} →
            </Link>
          </div>
          {rows.map((s) => (
            <ScrutinCard key={s.id} scrutin={s} />
          ))}
        </section>
      )}
    </div>
  );
}
