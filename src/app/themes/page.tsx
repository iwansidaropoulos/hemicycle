import Link from "next/link";

import { getThemeCounts } from "@/db/queries";
import { fr } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";

export const metadata = { title: `${fr.themes.title} — ${fr.appName}` };
export const revalidate = 3600;

export default async function ThemesPage() {
  const counts = await getThemeCounts();
  const hasAny = counts.size > 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        {fr.themes.title}
      </h1>
      <p className="max-w-2xl text-sm text-zinc-600">{fr.themes.intro}</p>

      {!hasAny && (
        <p className="rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-500">
          {fr.themes.empty}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {THEMES.map((t) => {
          const n = counts.get(t.id) ?? 0;
          return (
            <Link
              key={t.id}
              href={`/themes/${t.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm transition hover:border-zinc-300 hover:shadow-sm"
            >
              <span className="font-medium text-zinc-800">{t.label}</span>
              <span className="text-xs text-zinc-400">
                {n > 0 ? fr.themes.count(n) : "—"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
