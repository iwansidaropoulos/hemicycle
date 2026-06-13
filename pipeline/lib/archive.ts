/**
 * Download + unzip helpers for the open-data archives.
 *
 * The AN datasets are distributed as ZIP files containing thousands of small
 * JSON files. We fetch the archive into memory and unzip it with fflate (a
 * tiny, dependency-free zip implementation), then expose the entries as parsed
 * JSON keyed by their path inside the archive.
 */

import { unzipSync } from "fflate";

/** Download a URL and return its raw bytes. */
export async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: { "User-Agent": "hemicycle-pipeline (+https://github.com/iwansidaropoulos/hemicycle)" },
  });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status} ${res.statusText}): ${url}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/** A single JSON file extracted from an archive. */
export interface ArchiveEntry<T = unknown> {
  /** Path inside the zip, e.g. "json/acteur/PA841605.json". */
  path: string;
  data: T;
}

/**
 * Download an archive and return its `.json` entries, parsed. `filter` lets the
 * caller keep only the paths it cares about (e.g. a given subfolder).
 *
 * Suitable for the small archives. For the very large scrutins archive, prefer
 * `downloadAndIterate` so parsed objects are not all retained at once.
 */
export async function downloadJsonArchive<T = unknown>(
  url: string,
  filter?: (path: string) => boolean,
): Promise<ArchiveEntry<T>[]> {
  const entries: ArchiveEntry<T>[] = [];
  await downloadAndIterate<T>(url, (path, data) => {
    entries.push({ path, data });
  }, filter);
  return entries;
}

/**
 * Download an archive, unzip it, and invoke `onEntry` for each parsed `.json`
 * file in turn. Parsed objects are not retained by this function, so the caller
 * controls peak memory (important for the million-row scrutins archive).
 */
export async function downloadAndIterate<T = unknown>(
  url: string,
  onEntry: (path: string, data: T) => void,
  filter?: (path: string) => boolean,
): Promise<void> {
  const bytes = await download(url);
  const files = unzipSync(bytes);
  const decoder = new TextDecoder("utf-8");
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith(".json")) continue;
    if (filter && !filter(path)) continue;
    if (content.length === 0) continue;
    onEntry(path, JSON.parse(decoder.decode(content)) as T);
  }
}
