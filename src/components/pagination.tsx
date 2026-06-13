import Link from "next/link";

import { fr } from "@/lib/i18n";

/**
 * Previous/next pagination rendered as plain links so it works without JS and
 * keeps the current query string. `basePath` + existing params + a `page` param.
 */
export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  params = {},
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    return `${basePath}${sp.toString() ? `?${sp}` : ""}`;
  };

  return (
    <nav className="flex items-center justify-between gap-4 pt-2 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-zinc-700 hover:underline">
          {fr.pagination.previous}
        </Link>
      ) : (
        <span className="text-zinc-300">{fr.pagination.previous}</span>
      )}
      <span className="text-zinc-500">
        {fr.pagination.page(page)} / {lastPage}
      </span>
      {page < lastPage ? (
        <Link href={href(page + 1)} className="text-zinc-700 hover:underline">
          {fr.pagination.next}
        </Link>
      ) : (
        <span className="text-zinc-300">{fr.pagination.next}</span>
      )}
    </nav>
  );
}
