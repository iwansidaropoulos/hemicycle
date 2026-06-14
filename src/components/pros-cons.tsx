import { RichText } from "@/components/ai-block";
import { fr } from "@/lib/i18n";

/**
 * Arguments for / against the text, drawn from the debate. Carries the
 * "Généré par IA" label like the other AI content.
 */
export function ProsCons({
  pour,
  contre,
}: {
  pour: string | null | undefined;
  contre: string | null | undefined;
}) {
  if (!pour && !contre) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {fr.ai.prosCons}
        </h2>
        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {fr.ai.badge}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h3 className="mb-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {fr.ai.pour}
          </h3>
          {pour ? (
            <RichText text={pour} />
          ) : (
            <p className="text-sm italic text-zinc-400">{fr.ai.notYet}</p>
          )}
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
          <h3 className="mb-1 text-sm font-semibold text-rose-800 dark:text-rose-300">
            {fr.ai.contre}
          </h3>
          {contre ? (
            <RichText text={contre} />
          ) : (
            <p className="text-sm italic text-zinc-400">{fr.ai.notYet}</p>
          )}
        </div>
      </div>
    </section>
  );
}
