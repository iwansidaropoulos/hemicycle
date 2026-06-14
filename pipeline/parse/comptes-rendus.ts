/**
 * Parser for the Assemblée nationale "comptes rendus de séance" (syceron XML).
 * Each file is one séance; we extract its séance reference and the list of
 * interventions (speaker name, speaker acteur id, spoken text). The text feeds
 * the AI session summary; the acteur id lets us attach each speaker to a group.
 *
 * The format is machine-generated and consistent, so targeted extraction is
 * reliable and avoids a heavyweight XML dependency. Text is recovered by
 * stripping inner tags, which handles nested markup transparently.
 */

export interface Intervention {
  speaker: string;
  acteurId: string | null; // AN deputy uid (e.g. "PA794810"), when resolvable
  text: string;
}

/** The séance reference (matches our sessions.id), or null. */
export function parseSeanceRef(xml: string): string | null {
  return xml.match(/<seanceRef>([^<]+)<\/seanceRef>/)?.[1]?.trim() ?? null;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&rsquo;": "’",
  "&laquo;": "«",
  "&raquo;": "»",
  "&nbsp;": " ",
};

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&[a-zA-Z]+;/g, (e) => ENTITIES[e] ?? " ");
}

function stripTags(s: string): string {
  return decode(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract all interventions (speaker + text) from a compte-rendu XML. */
export function parseInterventions(xml: string): Intervention[] {
  const out: Intervention[] = [];
  const paragraphs = xml.match(/<paragraphe\b[\s\S]*?<\/paragraphe>/g) ?? [];
  for (const p of paragraphs) {
    const texteRaw = p.match(/<texte\b[^>]*>([\s\S]*?)<\/texte>/)?.[1];
    if (!texteRaw) continue;
    const text = stripTags(texteRaw);
    if (!text) continue;

    const orateur = p.match(/<orateur>([\s\S]*?)<\/orateur>/)?.[1] ?? "";
    const speaker = decode(
      (orateur.match(/<nom>([\s\S]*?)<\/nom>/)?.[1] ?? "").replace(/<[^>]+>/g, ""),
    ).trim();
    const rawId = orateur.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();
    const acteurId = rawId ? `PA${rawId}` : null;

    out.push({ speaker, acteurId, text });
  }
  return out;
}
