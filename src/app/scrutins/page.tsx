import { Pagination } from "@/components/pagination";
import { ScrutinCard } from "@/components/scrutin-card";
import { ScrutinFilters } from "@/components/scrutin-filters";
import { listScrutins, PAGE_SIZE } from "@/db/queries";
import { fr } from "@/lib/i18n";
import { isKnownTheme } from "@/lib/themes";

export const metadata = { title: `${fr.scrutins.title} — ${fr.appName}` };

interface SearchParams {
  q?: string;
  theme?: string;
  page?: string;
}

export default async function ScrutinsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() || undefined;
  const theme = sp.theme && isKnownTheme(sp.theme) ? sp.theme : undefined;

  const { rows, total } = await listScrutins({
    q,
    theme,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {fr.scrutins.title}
        </h1>
        <span className="text-sm text-zinc-500">{fr.scrutins.count(total)}</span>
      </div>

      <ScrutinFilters />

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
        basePath="/scrutins"
        params={{ q, theme }}
      />
    </div>
  );
}
