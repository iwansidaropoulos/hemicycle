import { Fragment } from "react";

import { fr } from "@/lib/i18n";

export interface AiSource {
  title: string;
  url: string;
}

/** Render minimal markdown: paragraphs (blank lines) and **bold** spans. */
export function RichText({ text }: { text: string }) {
  const paragraphs = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      {paragraphs.map((para, pi) => (
        <p key={pi}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

/**
 * Wrapper for AI-generated content. Always carries the "Généré par IA" label
 * (brief transparency requirement §8). Renders a muted placeholder when the
 * content has not been generated yet, and lists the grounding sources when the
 * content was produced with web grounding.
 */
export function AiBlock({
  title,
  content,
  sources,
}: {
  title: string;
  content: string | null | undefined;
  sources?: AiSource[];
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2>
        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {fr.ai.badge}
        </span>
      </div>
      {content ? (
        <RichText text={content} />
      ) : (
        <p className="text-sm italic text-zinc-400 dark:text-zinc-500">{fr.ai.notYet}</p>
      )}

      {content && sources && sources.length > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            {fr.ai.sources}
          </p>
          <ul className="mt-1 space-y-0.5">
            {sources.map((s) => (
              <li key={s.url} className="truncate text-xs">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline dark:text-blue-400"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
