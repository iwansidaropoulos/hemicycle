/**
 * libSQL / Turso client + Drizzle instance used by the web app.
 *
 * The app only ever *reads* from Turso (see brief §2): all writes happen in the
 * ingestion pipeline. Credentials come from environment variables — on Vercel
 * these are project env vars, locally they live in `.env`.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
  );
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });

export type Database = typeof db;
