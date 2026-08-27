import { CACHE_STORE, idbAvailable, idbGet, idbPut } from "@/lib/offline-db";

/**
 * Master-data snapshots (planning areas, categories, user directory) so the
 * event drawer still offers real selects while offline. Only non-sensitive
 * display data is stored — never tokens or credentials.
 */

type CacheRecord<T> = { key: string; value: T; saved_at: string };

export async function writeCache<T>(key: string, value: T) {
  if (!idbAvailable()) return;
  try {
    await idbPut<CacheRecord<T>>(CACHE_STORE, { key, value, saved_at: new Date().toISOString() });
  } catch {
    // Caching is best-effort.
  }
}

export async function readCache<T>(key: string): Promise<T | null> {
  if (!idbAvailable()) return null;
  try {
    const record = await idbGet<CacheRecord<T>>(CACHE_STORE, key);
    return record ? record.value : null;
  } catch {
    return null;
  }
}

/** Fetch online, cache the result; fall back to the last snapshot when offline. */
export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const value = await fetcher();
    void writeCache(key, value);
    return value;
  } catch (error) {
    const cached = await readCache<T>(key);
    if (cached) return cached;
    throw error;
  }
}
