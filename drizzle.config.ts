/**
 * Drizzle Kit configuration — used to generate and push SQL migrations to
 * Turso. Reads credentials from `.env` (loaded via dotenv) so the same env
 * names are used everywhere.
 */

import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
