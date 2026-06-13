import { fr } from "@/lib/i18n";

/** Footer carrying the mandatory Etalab Open Licence attribution (brief §9). */
export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
        <p>
          {fr.footer.dataSource}{" "}
          <a
            href="https://data.assemblee-nationale.fr/"
            className="underline hover:text-zinc-700 dark:hover:text-zinc-200"
            target="_blank"
            rel="noreferrer"
          >
            data.assemblee-nationale.fr
          </a>{" "}
          {fr.footer.licence}.
        </p>
        <p>{fr.footer.aiNotice}</p>
      </div>
    </footer>
  );
}
