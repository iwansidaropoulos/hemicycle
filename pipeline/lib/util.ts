/**
 * Small helpers shared across the parsers.
 */

/**
 * The AN JSON is converted from XML, so a node that *can* repeat is an array
 * when there are several entries but a bare object when there is exactly one
 * (and `null`/absent when there are none). This normalizes any of those shapes
 * into a plain array.
 */
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Parse an integer field that may be a string, null or undefined. */
export function toInt(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Split an array into chunks of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
