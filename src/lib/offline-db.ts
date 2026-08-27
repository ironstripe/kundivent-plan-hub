/**
 * Minimal IndexedDB layer for PWA phase 2.
 *
 * Two stores:
 *  - `pending_events`: new events created while offline, waiting to be synced.
 *  - `cache`: small master-data snapshots so offline creation has usable selects.
 *
 * localStorage is deliberately NOT used for event payloads.
 */

const DB_NAME = "kundivent-offline";
const DB_VERSION = 1;
export const PENDING_STORE = "pending_events";
export const CACHE_STORE = "cache";

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbAvailable() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!idbAvailable()) return Promise.reject(new Error("IndexedDB nicht verfügbar"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PENDING_STORE)) {
          const store = db.createObjectStore(PENDING_STORE, { keyPath: "id" });
          store.createIndex("user_id", "user_id", { unique: false });
        }
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export function idbGetAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

export function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function idbPut<T>(store: string, value: T): Promise<unknown> {
  return tx(store, "readwrite", (s) => s.put(value as unknown as never));
}

export function idbDelete(store: string, key: string): Promise<unknown> {
  return tx(store, "readwrite", (s) => s.delete(key));
}
