/**
 * The places a person visited on this device, newest first: the quick
 * switcher (quickSwitch.ts, Ctrl+K) lists them first. Kept apart from the
 * switcher, so recording a visit does not load its search.
 */
const KEY = "zrzur:recent-places:";
const MAX = 12;
const ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** The place an address stands for: a channel, or a server without one */
export function placeFromPath(pathname: string): string | undefined {
  const channel = /\/channel\/([0-9A-HJKMNP-TV-Z]{26})/.exec(pathname)?.[1];
  if (channel) return channel;
  return /^\/server\/([0-9A-HJKMNP-TV-Z]{26})\/?$/.exec(pathname)?.[1];
}

/** Ids of places this account visited on this device, most recent first */
export function recentPlaces(userId: string | undefined): string[] {
  if (!userId) return [];
  try {
    const list = JSON.parse(localStorage.getItem(KEY + userId) ?? "[]");
    return Array.isArray(list)
      ? list.filter((id) => typeof id === "string" && ID.test(id))
      : [];
  } catch {
    return [];
  }
}

/** Remember a visit (the app calls this on every navigation) */
export function notePlace(pathname: string, userId: string | undefined) {
  const id = placeFromPath(pathname);
  if (!id || !userId) return;
  try {
    const next = [id, ...recentPlaces(userId).filter((other) => other !== id)];
    localStorage.setItem(KEY + userId, JSON.stringify(next.slice(0, MAX)));
  } catch {
    // private mode or full storage: recent places are a convenience
  }
}

/** Signing out: every account's recent places go (as creatorCache.ts does) */
export function forgetRecentPlaces() {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index),
    );
    for (const key of keys)
      if (key?.startsWith(KEY)) localStorage.removeItem(key);
  } catch {
    // nothing could be stored either
  }
}
