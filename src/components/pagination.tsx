import Link from "next/link";

/**
 * Numbered pagination: prev/next arrows plus a window of clickable page numbers
 * centered on the current page, with shortcuts to the first and last page and
 * ellipses for the gaps. Rendered as plain links (works without JS, preserves
 * the current query string).
 */

// Page numbers shown on each side of the current page.
const WINDOW = 4;

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

  // Build the list of page numbers to show, with -1 marking an ellipsis.
  const start = Math.max(1, page - WINDOW);
  const end = Math.min(lastPage, page + WINDOW);
  const pages: number[] = [];
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push(-1);
  }
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < lastPage) {
    if (end < lastPage - 1) pages.push(-1);
    pages.push(lastPage);
  }

  const arrow =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm";
  const numBase =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular-nums";

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1 pt-2">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          aria-label="Page précédente"
          className={`${arrow} text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800`}
        >
          ‹
        </Link>
      ) : (
        <span className={`${arrow} text-zinc-300 dark:text-zinc-700`}>‹</span>
      )}

      {pages.map((p, i) =>
        p === -1 ? (
          <span key={`e${i}`} className="px-1 text-zinc-400 dark:text-zinc-600">
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            className={`${numBase} bg-indigo-600 font-medium text-white`}
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            className={`${numBase} text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`}
          >
            {p}
          </Link>
        ),
      )}

      {page < lastPage ? (
        <Link
          href={href(page + 1)}
          aria-label="Page suivante"
          className={`${arrow} text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800`}
        >
          ›
        </Link>
      ) : (
        <span className={`${arrow} text-zinc-300 dark:text-zinc-700`}>›</span>
      )}
    </nav>
  );
}
