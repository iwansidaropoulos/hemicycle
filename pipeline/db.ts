/**
 * Write-access Drizzle client for the pipeline. Uses the SAME Turso credentials
 * as the app (brief §9: the URL+token live in GitHub Secrets for the pipeline
 * and in Vercel env vars for the read-only app). The schema is shared with the
 * app so there is a single source of truth.
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../src/db/schema";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. In CI it comes from GitHub Secrets; " +
      "locally, copy .env.example to .env and fill it in.",
  );
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
export { schema };
