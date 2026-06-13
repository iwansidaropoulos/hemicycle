import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/pagination";
import { ScrutinCard } from "@/components/scrutin-card";
import { listScrutins, PAGE_SIZE } from "@/db/queries";
import { fr } from "@/lib/i18n";
import { isKnownTheme, themeLabel } from "@/lib/themes";

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { theme } = await params;
  if (!isKnownTheme(theme)) notFound();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { rows, total } = await listScrutins({
    theme,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div className="space-y-5">
      <Link href="/themes" className="text-sm text-zinc-500 hover:underline">
        ← {fr.themes.title}
      </Link>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {themeLabel(theme)}
        </h1>
        <span className="text-sm text-zinc-500">{fr.scrutins.count(total)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-zinc-500">{fr.scrutins.none}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <ScrutinCard key={s.id} scrutin={s} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        basePath={`/themes/${theme}`}
      />
    </div>
  );
}
