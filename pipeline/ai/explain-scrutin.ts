/**
 * Scrutin explanation + summary (brief §7), for the significant scrutins only
 * (solennel / motion de censure / vote on the whole text), with the capable
 * model.
 *
 * Batched to live within the Gemini free-tier request quota: one request
 * explains several scrutins at once.
 *
 * Strict grounding: the model relies ONLY on the provided sources (each
 * scrutin's title and subject, and its dossier's title/type). It must say when
 * information is missing rather than invent it, stay strictly neutral, French.
 */

import { Type } from "@google/genai";

import { genai, WRITING_MODEL } from "./client";

const SYSTEM = `Tu rédiges des fiches neutres et factuelles sur des scrutins de l'Assemblée nationale française, en français.
Pour CHAQUE scrutin fourni, tu t'appuies UNIQUEMENT sur ses sources (intitulé et objet du scrutin, titre et type du dossier législatif).
Règles strictes et non négociables :
- N'utilise aucune connaissance extérieure sur la politique française. Si une information n'est pas dans les sources, ne l'invente pas : dis qu'elle n'est pas précisée.
- Neutralité absolue : décris ce sur quoi porte le vote, sans jugement de valeur, sans prise de position, sans qualifier les camps.
- "explanation" : 2 à 4 phrases expliquant en quoi consiste le scrutin (sur quoi porte le vote, dans quel cadre).
- "summary" : une seule phrase de synthèse.
- Reste sobre et précis, pas de formule d'introduction.
- Reprends exactement l'identifiant de chaque scrutin dans la réponse.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          explanation: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["id", "explanation", "summary"],
      },
    },
  },
  required: ["results"],
};

export interface ScrutinInput {
  titre: string;
  objet: string | null;
  dossierTitre: string | null;
  dossierType: string | null;
}

export interface ScrutinBatchItem extends ScrutinInput {
  id: string;
}

export interface ScrutinExplanation {
  explanation: string;
  summary: string;
}

/** Build the grounded source block; also used to compute the source hash. */
export function explanationSource(s: ScrutinInput): string {
  return [
    `Intitulé du scrutin : ${s.titre}`,
    `Objet : ${s.objet ?? "non précisé"}`,
    `Dossier législatif : ${s.dossierTitre ?? "non précisé"}`,
    `Type de dossier : ${s.dossierType ?? "non précisé"}`,
  ].join("\n");
}

/** Explain a batch of scrutins in one request. Returns a map keyed by id. */
export async function explainScrutinsBatch(
  scrutins: ScrutinBatchItem[],
): Promise<Map<string, ScrutinExplanation>> {
  const blocks = scrutins
    .map((s) => `--- Scrutin [id=${s.id}] ---\n${explanationSource(s)}`)
    .join("\n\n");

  const res = await genai.models.generateContent({
    model: WRITING_MODEL,
    contents: `Rédige une fiche pour chaque scrutin ci-dessous :\n\n${blocks}`,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  const out = new Map<string, ScrutinExplanation>();
  if (!res.text) return out;
  const parsed = JSON.parse(res.text) as {
    results?: Array<{ id?: string; explanation?: string; summary?: string }>;
  };
  for (const r of parsed.results ?? []) {
    if (!r.id) continue;
    out.set(r.id, { explanation: r.explanation ?? "", summary: r.summary ?? "" });
  }
  return out;
}
