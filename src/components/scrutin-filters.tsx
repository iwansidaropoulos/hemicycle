"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { fr } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";

/**
 * Title search + theme filter for the scrutins list. Updates the URL query
 * string (the page re-renders server-side from those params). Search is
 * debounced so we don't navigate on every keystroke.
 */
export function ScrutinFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const theme = params.get("theme") ?? "";
  const [q, setQ] = useState(urlQ);

  // Keep the input in sync if the URL changes externally (e.g. back button),
  // using the "adjust state during render" pattern (no effect needed).
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setQ(urlQ);
  }

  function pushParams(next: { q?: string; theme?: string }) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    sp.delete("page"); // any filter change resets pagination
    router.push(`/scrutins${sp.toString() ? `?${sp}` : ""}`);
  }

  // Debounce the title search.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => pushParams({ q, theme }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={fr.scrutins.searchPlaceholder}
        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <select
        value={theme}
        onChange={(e) => pushParams({ q, theme: e.target.value })}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <option value="">{fr.scrutins.allThemes}</option>
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
