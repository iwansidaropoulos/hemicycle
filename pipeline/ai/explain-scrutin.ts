/**
 * Scrutin explanation + summary (brief §7), for the significant scrutins only
 * (solennel / motion de censure / vote on the whole text).
 *
 * The Assemblée nationale open data does not include the exposé des motifs (only
 * descriptive metadata), so to actually explain what a text *does* we ground the
 * model with **Google Search** (Gemini's built-in tool): it looks the text up on
 * the web and writes a substantive, French, neutral explanation, and we keep the
 * cited sources so the output stays verifiable.
 */

import { genai, WRITING_MODEL } from "./client";

const SYSTEM = `Tu rédiges des fiches neutres et factuelles sur des scrutins de l'Assemblée nationale française, en français.
Sers-toi de la recherche web pour comprendre le texte de loi concerné, puis explique-le.
Règles :
- Neutralité absolue : décris ce que le texte propose et ce sur quoi porte le vote, sans jugement de valeur ni prise de position, sans qualifier les camps.
- Privilégie les sources fiables (Assemblée nationale, Sénat, Légifrance, Vie publique, presse de référence). Si tu ne trouves pas d'information fiable, dis-le plutôt que d'inventer.
- "explanation" : 4 à 7 phrases qui font comprendre le FOND (objet du texte, principales mesures, contexte, enjeu du vote).
- "summary" : une seule phrase de synthèse.
- Réponds UNIQUEMENT par un objet JSON: {"explanation": "...", "summary": "..."}. Pas de texte hors du JSON.`;

export interface ScrutinInput {
  titre: string;
  objet: string | null;
  dossierTitre: string | null;
  dossierType: string | null;
}

export interface ScrutinSource {
  title: string;
  url: string;
}

export interface ScrutinExplanation {
  explanation: string;
  summary: string;
  sources: ScrutinSource[];
}

/** Source block used for the prompt and for the change-detection hash. */
export function explanationSource(s: ScrutinInput): string {
  return [
    `Intitulé du scrutin : ${s.titre}`,
    `Objet : ${s.objet ?? "non précisé"}`,
    `Dossier législatif : ${s.dossierTitre ?? "non précisé"}`,
    `Type de dossier : ${s.dossierType ?? "non précisé"}`,
  ].join("\n");
}

/** Extract {explanation, summary} from a possibly-fenced JSON-ish text. */
function parseOutput(text: string): { explanation: string; summary: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1)) as {
        explanation?: string;
        summary?: string;
      };
      if (obj.explanation) {
        return { explanation: obj.explanation, summary: obj.summary ?? "" };
      }
    } catch {
      // fall through to plain-text fallback
    }
  }
  // Fallback: use the whole text as the explanation, first sentence as summary.
  const clean = text.trim();
  const firstSentence = clean.split(/(?<=\.)\s/)[0] ?? clean;
  return { explanation: clean, summary: firstSentence };
}

/** Grounded explanation for a single scrutin, with cited web sources. */
export async function explainScrutinGrounded(
  s: ScrutinInput,
): Promise<ScrutinExplanation> {
  const res = await genai.models.generateContent({
    model: WRITING_MODEL,
    contents: `Explique ce scrutin en t'appuyant sur une recherche web du texte de loi concerné.\n\n${explanationSource(s)}`,
    config: {
      systemInstruction: SYSTEM,
      tools: [{ googleSearch: {} }],
      temperature: 0,
    },
  });

  const { explanation, summary } = parseOutput(res.text ?? "");

  // Collect the grounding sources (deduped by url).
  const chunks =
    res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: ScrutinSource[] = [];
  for (const c of chunks) {
    const url = c.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: c.web?.title ?? url, url });
  }

  return { explanation, summary, sources };
}
