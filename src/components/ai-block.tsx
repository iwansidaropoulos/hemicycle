import { fr } from "@/lib/i18n";

/**
 * Wrapper for AI-generated content. Always carries the "Généré par IA" label
 * (brief transparency requirement §8). Renders a muted placeholder when the
 * content has not been generated yet.
 */
export function AiBlock({
  title,
  content,
}: {
  title: string;
  content: string | null | undefined;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700">
          {fr.ai.badge}
        </span>
      </div>
      {content ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">
          {content}
        </p>
      ) : (
        <p className="text-sm italic text-zinc-400">{fr.ai.notYet}</p>
      )}
    </section>
  );
}
