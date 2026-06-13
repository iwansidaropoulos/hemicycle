/**
 * Theme tagging (brief §7). Classifies a *dossier* into the fixed taxonomy with
 * the light model. Uses Gemini structured output with an `enum` over the
 * taxonomy ids, so the model can only ever return valid themes — no free tags.
 *
 * Grounding: the model sees only the dossier's title and type, and is told to
 * pick only clearly-applicable themes and invent nothing.
 */

import { Type } from "@google/genai";

import { genai, TAGGING_MODEL } from "./client";
import { THEMES } from "../../src/lib/themes";

const THEME_IDS = THEMES.map((t) => t.id);

const SYSTEM = `Tu es un assistant qui classe des dossiers législatifs de l'Assemblée nationale par thème.
À partir UNIQUEMENT du titre et du type fournis, choisis les thèmes de la liste fournie qui s'appliquent clairement au dossier.
Règles strictes :
- N'utilise que les thèmes de la liste (identifiants imposés).
- Ne choisis un thème que s'il est manifestement pertinent au vu du titre. En cas de doute, ne le mets pas.
- La plupart des dossiers ont 1 à 3 thèmes. N'invente rien et ne te fie pas à des connaissances extérieures.
- Si aucun thème ne convient, renvoie une liste vide.`;

const TAXONOMY_TEXT = THEMES.map((t) => `- ${t.id} : ${t.label}`).join("\n");

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    themes: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: THEME_IDS },
    },
  },
  required: ["themes"],
};

interface DossierInput {
  titre: string;
  type: string | null;
}

/** Return the taxonomy theme ids that apply to a dossier. */
export async function tagDossierThemes(d: DossierInput): Promise<string[]> {
  const prompt = `Thèmes disponibles :\n${TAXONOMY_TEXT}\n\nDossier à classer :\nTitre : ${d.titre}\nType : ${d.type ?? "non précisé"}`;

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

  const text = res.text;
  if (!text) return [];
  const parsed = JSON.parse(text) as { themes?: string[] };
  // Defensive: keep only known ids, dedupe.
  return [...new Set((parsed.themes ?? []).filter((t) => THEME_IDS.includes(t)))];
}
