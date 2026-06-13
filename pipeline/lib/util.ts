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

/** Pause for `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run an async operation with retries and exponential backoff. The backfill
 * writes millions of rows over the network, so a single transient libSQL/HTTP
 * error must not abort the whole run.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 5, baseDelayMs = 500, label = "operation" }: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const wait = baseDelayMs * 2 ** i;
      console.warn(
        `[ingest] ${label} failed (attempt ${i + 1}/${attempts}): ${
          (err as Error)?.message ?? err
        } — retrying in ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}
