import Link from "next/link";

import { getEnrichmentProgress, getRecentlyExplained } from "@/db/queries";
import { formatDate } from "@/lib/format";
import { fr } from "@/lib/i18n";

export const metadata = { title: `Avancement — ${fr.appName}` };
// Always read fresh progress.
export const dynamic = "force-dynamic";

function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function Bar({
  label,
  done,
  total,
  note,
}: {
  label: string;
  done: number;
  total: number;
  note?: string;
}) {
  const p = pct(done, total);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-zinc-800">{label}</span>
        <span className="text-zinc-500">
          {done.toLocaleString("fr-FR")} / {total.toLocaleString("fr-FR")} ({p} %)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${p}%` }} />
      </div>
      {note && <p className="text-xs text-zinc-400">{note}</p>}
    </div>
  );
}

export default async function StatutPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  // Optional gate: if ADMIN_TOKEN is set (Vercel env var), require ?token=...
  const required = process.env.ADMIN_TOKEN;
  const { token } = await searchParams;
  if (required && token !== required) {
    return (
      <p className="py-12 text-center text-zinc-500">
        Accès restreint. Ajoutez <code>?token=…</code> à l’URL.
      </p>
    );
  }

  const [p, recent] = await Promise.all([
    getEnrichmentProgress(),
    getRecentlyExplained(15),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Avancement de l’enrichissement
        </h1>
        <p className="text-sm text-zinc-500">
          Mise à jour automatique à chaque exécution du pipeline (cron quotidien).
        </p>
      </header>

      <section className="space-y-5">
        <Bar
          label="Scrutins expliqués par IA"
          done={p.scrutinsExplained}
          total={p.scrutinsEligible}
          note="Parmi les scrutins solennels, motions de censure et votes sur l’ensemble d’un texte."
        />
        <Bar
          label="Dossiers étiquetés par thème"
          done={p.dossiersTagged}
          total={p.dossiersTotal}
          note="Les dossiers liés à des scrutins sont traités en priorité."
        />
        <Bar
          label="Scrutins couverts par un thème"
          done={p.scrutinsWithTheme}
          total={p.scrutinsTotal}
          note="Un scrutin hérite des thèmes de son dossier ; tous les scrutins n’ont pas de dossier rattaché dans l’open data."
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium text-zinc-800">
          Derniers scrutins expliqués
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-400">Aucun pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white text-sm">
            {recent.map(({ scrutin }) => (
              <li key={scrutin.id}>
                <Link
                  href={`/scrutins/${scrutin.id}`}
                  className="flex items-baseline gap-3 px-4 py-2 hover:bg-zinc-50"
                >
                  <span className="text-xs text-zinc-400">
                    {formatDate(scrutin.date)}
                  </span>
                  <span className="truncate text-zinc-700">{scrutin.titre}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
