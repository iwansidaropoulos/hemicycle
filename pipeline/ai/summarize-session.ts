/**
 * Session summary (brief §8). Summarizes a séance from its official verbatim
 * record (compte rendu), grounded ONLY in that text — no web, no external
 * knowledge. The summary deliberately focuses on the DISAGREEMENTS between
 * parliamentary groups: who opposed whom, on what, and the arguments each side
 * put forward — rather than a flat "the debate covered X and Y".
 */

import { genai, WRITING_MODEL } from "./client";

const SYSTEM = `Tu rédiges, en français, une synthèse neutre des débats d'une séance de l'Assemblée nationale, à partir UNIQUEMENT du compte rendu fourni.
Objectif : faire ressortir les OPPOSITIONS entre groupes parlementaires, pas une liste de thèmes.
Pour chaque désaccord marquant, indique :
- quels intervenants (et leur groupe) se sont opposés,
- sur quel point précis,
- les arguments avancés de chaque côté.
Style attendu, par exemple : « X (groupe A) et Y (groupe B) se sont opposés sur … ; pour X : … ; pour Y : … ».
Règles :
- Neutralité absolue : rapporte les arguments sans les juger ni prendre parti.
- Appuie-toi uniquement sur le compte rendu fourni ; n'invente rien.
- Concentre-toi sur 2 à 5 oppositions de fond les plus saillantes. Ignore le procédural.
- Si la séance ne contient pas de véritable débat contradictoire (ex. questions au Gouvernement), résume les principaux échanges et tensions.
- 3 à 6 paragraphes courts, prose claire, sans préambule.`;

const MAX_CHARS = 110_000;

export interface SessionIntervention {
  speaker: string;
  group: string | null;
  text: string;
}

/** Build the debate transcript text fed to the model (speaker + group + text). */
export function buildTranscript(items: SessionIntervention[]): string {
  const lines: string[] = [];
  let total = 0;
  for (const it of items) {
    const who = it.group ? `${it.speaker} (${it.group})` : it.speaker;
    const line = `${who} : ${it.text}`;
    total += line.length;
    if (total > MAX_CHARS) {
      lines.push("[…suite du débat tronquée…]");
      break;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

/** Summarize a séance's debates, grounded in the transcript. */
export async function summarizeSession(transcript: string): Promise<string> {
  const res = await genai.models.generateContent({
    model: WRITING_MODEL,
    contents: `Compte rendu de la séance :\n\n${transcript}`,
    config: { systemInstruction: SYSTEM, temperature: 0.2 },
  });
  return (res.text ?? "").trim();
}
