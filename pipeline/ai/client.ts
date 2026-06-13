/**
 * Google Gemini client + model configuration for the enrichment step.
 *
 * The brief specified Anthropic, but a Claude/Anthropic API key requires paid
 * credits; this project must stay free, so enrichment runs on the Google Gemini
 * API free tier (a free AI Studio key, no billing). Only the pipeline's LLM
 * calls use this — the web app never calls any model. The two AI levels (brief
 * §7) are preserved: a light model for theme tagging on every dossier, a more
 * capable one for explanations on the few significant scrutins.
 *
 * The API key lives ONLY in GitHub Secrets and the local .env.
 */

import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey, " +
      "then add it to .env (local) and GitHub Secrets (CI). The web app never needs it.",
  );
}

export const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/** Light/economical model for theme tagging (all dossiers). */
export const TAGGING_MODEL = process.env.TAGGING_MODEL ?? "gemini-2.5-flash-lite";
/** More capable model for explanations and summaries (significant scrutins). */
export const WRITING_MODEL = process.env.WRITING_MODEL ?? "gemini-2.5-flash";

/** True when an error is a rate-limit / quota-exhausted response (free tier). */
export function isRateLimited(err: unknown): boolean {
  const msg = (err as Error)?.message ?? String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("rate limit")
  );
}
