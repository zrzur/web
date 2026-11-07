/**
 * Changes still waiting to reach IndexedDB when the page goes away. The
 * IndexedDB write is asynchronous and a reload or closed tab can cut it
 * off, so the change is also kept (synchronously) in localStorage and
 * picked up on the next start.
 */

type SyncStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "zrzur.pending.";

/** localStorage, or undefined where the browser blocks it */
export function pageStorage(): SyncStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Never copied to localStorage: holds the session token */
const NEVER = new Set(["auth"]);

/**
 * Keep a change that has not reached IndexedDB yet
 */
export function stashPending(
  storage: SyncStorage | undefined,
  key: string,
  value: unknown,
) {
  if (!storage || NEVER.has(key)) return;
  try {
    storage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the IndexedDB write may still finish
  }
}

/**
 * Take back a kept change (once), or undefined
 */
export function takePending(
  storage: SyncStorage | undefined,
  key: string,
): unknown {
  if (!storage || NEVER.has(key)) return;
  try {
    const raw = storage.getItem(PREFIX + key);
    if (raw === null) return;
    storage.removeItem(PREFIX + key);
    return JSON.parse(raw);
  } catch {
    try {
      storage?.removeItem(PREFIX + key);
    } catch {
      // nothing more to do
    }
    return;
  }
}
