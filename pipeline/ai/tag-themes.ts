/**
 * Theme tagging (brief §7). Classifies *dossiers* into the fixed taxonomy with
 * the light model, using Gemini structured output constrained to a taxonomy
 * enum (no free-form tags).
 *
 * The Gemini free tier allows only ~20 requests/day per model, so dossiers are
 * classified in BATCHES — one request handles many dossiers at once — which
 * keeps the backfill within the free quota.
 *
 * Grounding: the model sees only each dossier's title and type, and is told to
 * pick only clearly-applicable themes and invent nothing.
 */

import { Type } from "@google/genai";

import { genai, TAGGING_MODEL } from "./client";
import { THEMES } from "../../src/lib/themes";

const THEME_IDS = THEMES.map((t) => t.id);

const SYSTEM = `Tu es un assistant qui classe des dossiers législatifs de l'Assemblée nationale par thème.
À partir UNIQUEMENT du titre et du type de chaque dossier, choisis les thèmes de la liste fournie qui s'appliquent clairement.
Règles strictes :
- N'utilise que les thèmes de la liste (identifiants imposés).
- Ne choisis un thème que s'il est manifestement pertinent au vu du titre. En cas de doute, ne le mets pas.
- La plupart des dossiers ont 1 à 3 thèmes. N'invente rien et ne te fie pas à des connaissances extérieures.
- Si aucun thème ne convient pour un dossier, renvoie une liste vide pour celui-ci.
- Renvoie un résultat pour CHAQUE dossier, en reprenant exactement son identifiant.`;

const TAXONOMY_TEXT = THEMES.map((t) => `- ${t.id} : ${t.label}`).join("\n");

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          themes: { type: Type.ARRAY, items: { type: Type.STRING, enum: THEME_IDS } },
        },
        required: ["id", "themes"],
      },
    },
  },
  required: ["results"],
};

export interface DossierBatchItem {
  id: string;
  titre: string;
  type: string | null;
}

/**
 * Classify a batch of dossiers in a single request. Returns a map from dossier
 * id to its theme ids. Dossiers absent from the model's answer map to [].
 */
export async function tagDossiersBatch(
  dossiers: DossierBatchItem[],
): Promise<Map<string, string[]>> {
  const list = dossiers
    .map((d) => `[id=${d.id}] Titre : ${d.titre} | Type : ${d.type ?? "non précisé"}`)
    .join("\n");
  const prompt = `Thèmes disponibles :\n${TAXONOMY_TEXT}\n\nClasse chacun des dossiers suivants (reprends l'identifiant exact dans la réponse) :\n${list}`;

  const res = await genai.models.generateContent({
    model: TAGGING_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  const out = new Map<string, string[]>();
  if (!res.text) return out;
  const parsed = JSON.parse(res.text) as {
    results?: Array<{ id?: string; themes?: string[] }>;
  };
  for (const r of parsed.results ?? []) {
    if (!r.id) continue;
    out.set(r.id, [
      ...new Set((r.themes ?? []).filter((t) => THEME_IDS.includes(t))),
    ]);
  }
  return out;
}
