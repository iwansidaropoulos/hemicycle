/**
 * Scrutin explanation + summary (brief §7), for the significant scrutins only
 * (solennel / motion de censure / vote on the whole text).
 *
 * Grounded in **Assemblée nationale data only** (no external web): the scrutin
 * and dossier metadata, plus excerpts from the official verbatim record of the
 * séance (compte rendu) — where the rapporteur and the minister present the
 * text and the groups debate it. The model must rely solely on those sources.
 */

import { genai, WRITING_MODEL } from "./client";

const SYSTEM = `Tu analyses, en français, un texte soumis au vote à l'Assemblée nationale.
Tu t'appuies UNIQUEMENT sur les sources officielles fournies : l'intitulé du scrutin et du dossier, et les extraits du compte rendu de la séance (débats).
Règles strictes :
- Neutralité absolue : rapporte les faits et les arguments des uns et des autres, sans jugement ni prise de position propre.
- Uniquement les sources fournies. N'utilise aucune connaissance extérieure. Si une information n'y figure pas, ne l'invente pas.
- "explanation" : 4 à 7 phrases sur le FOND du texte (objet, principales mesures, enjeu), d'après la présentation par le rapporteur/ministre et la discussion.
- "argumentsPour" : les arguments avancés EN FAVEUR du texte pendant le débat ; précise quels groupes/orateurs les portent. 2 à 5 phrases. Si le débat n'en contient pas, écris "Non précisé dans le compte rendu.".
- "argumentsContre" : les arguments avancés CONTRE le texte ; précise quels groupes/orateurs les portent. 2 à 5 phrases. Même consigne si absent.
- "summary" : une seule phrase de synthèse.
- Réponds UNIQUEMENT par un objet JSON: {"explanation","argumentsPour","argumentsContre","summary"}. Pas de texte hors du JSON. Tu peux mettre en gras avec **…**.`;

export interface ScrutinInput {
  titre: string;
  objet: string | null;
  dossierTitre: string | null;
  dossierType: string | null;
}

export interface ScrutinExplanation {
  explanation: string;
  argumentsPour: string;
  argumentsContre: string;
  summary: string;
}

/** Metadata block (also used for the change-detection hash). */
export function explanationSource(s: ScrutinInput): string {
  return [
    `Intitulé du scrutin : ${s.titre}`,
    `Objet : ${s.objet ?? "non précisé"}`,
    `Dossier législatif : ${s.dossierTitre ?? "non précisé"}`,
    `Type de dossier : ${s.dossierType ?? "non précisé"}`,
  ].join("\n");
}

function parseOutput(text: string): ScrutinExplanation {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1)) as Partial<ScrutinExplanation>;
      if (obj.explanation) {
        return {
          explanation: obj.explanation,
          argumentsPour: obj.argumentsPour ?? "",
          argumentsContre: obj.argumentsContre ?? "",
          summary: obj.summary ?? "",
        };
      }
    } catch {
      // fall through
    }
  }
  const clean = text.trim();
  return {
    explanation: clean,
    argumentsPour: "",
    argumentsContre: "",
    summary: clean.split(/(?<=\.)\s/)[0] ?? clean,
  };
}

/**
 * Explain a scrutin's text, grounded in its metadata and the séance debate
 * transcript. `transcript` may be empty if no record is available.
 */
export async function explainScrutinFromDebate(
  s: ScrutinInput,
  transcript: string,
): Promise<ScrutinExplanation> {
  const contents = [
    `Le scrutin porte sur : ${s.titre}`,
    `Explique CE texte précisément.`,
    ``,
    `Sources officielles :`,
    explanationSource(s),
    ``,
    `Extraits du compte rendu de la séance (débats) :`,
    transcript || "(compte rendu non disponible)",
  ].join("\n");

  const res = await genai.models.generateContent({
    model: WRITING_MODEL,
    contents,
    config: { systemInstruction: SYSTEM, temperature: 0.2 },
  });

  return parseOutput(res.text ?? "");
}
