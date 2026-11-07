/**
 * Where saved settings live: a key-value store in IndexedDB, or localStorage
 * where IndexedDB can't open. Uses the database, store and key prefix of
 * localforage, which this replaced, so saved settings carry over.
 */
const DATABASE = "localforage";
const STORE = "keyvaluepairs";
const FALLBACK_PREFIX = "localforage/";

let opening: Promise<IDBDatabase | undefined> | undefined;

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function open(version?: number) {
  const req = indexedDB.open(DATABASE, version);
  req.onupgradeneeded = () => {
    if (!req.result.objectStoreNames.contains(STORE))
      req.result.createObjectStore(STORE);
  };
  return request(req);
}

async function connect() {
  try {
    const db = await open();
    if (db.objectStoreNames.contains(STORE)) return db;
    // a database made without the store: an upgrade adds it
    const version = db.version + 1;
    db.close();
    return await open(version);
  } catch {
    return undefined;
  }
}

function database() {
  opening ??= typeof indexedDB === "undefined" ? undefined : connect();
  return opening ?? Promise.resolve(undefined);
}

export async function diskGet<T = unknown>(key: string): Promise<T | null> {
  const db = await database();
  if (db) {
    const value = await request(
      db.transaction(STORE, "readonly").objectStore(STORE).get(key),
    );
    return (value as T | undefined) ?? null;
  }

  const stored = localStorage.getItem(FALLBACK_PREFIX + key);
  return stored === null ? null : (JSON.parse(stored) as T);
}

export async function diskSet(key: string, value: unknown): Promise<void> {
  const db = await database();
  if (db) {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value ?? null, key);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () =>
        reject(transaction.error);
    });
    return;
  }

  localStorage.setItem(FALLBACK_PREFIX + key, JSON.stringify(value ?? null));
}

/** Forget the open connection (tests) */
export function resetDiskConnection() {
  opening = undefined;
}
