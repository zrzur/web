import type { User } from "@zrzur/sdk/solid";

/** What two people share, as the server lists it */
export type Mutual = { servers: string[]; users: string[] };

/** A profile opened again within this time reuses the list */
const KEEP_MS = 60_000;
/** Pairs remembered at once; the oldest goes first */
const MAX_PEOPLE = 50;

type Entry = { at: number; list: Promise<Mutual | null> };
const cache = new Map<string, Entry>();

/**
 * The servers and friends the viewer shares with `user`, kept for a minute
 * so opening a card again asks nothing. Kept per viewer and person, so a
 * second account on this device never sees the first one's list. A refusal
 * (someone blocked, or no shared connection) is `null`: nothing is shown,
 * and nothing is kept.
 */
export function mutualFor(
  user: User,
  viewerId: string,
): Promise<Mutual | null> {
  const key = `${viewerId}:${user.id}`;
  const now = Date.now();
  const kept = cache.get(key);
  if (kept && now - kept.at < KEEP_MS) return kept.list;

  const entry: Entry = { at: now, list: Promise.resolve(null) };
  entry.list = user.fetchMutual().then(
    (mutual) => ({ servers: mutual.servers ?? [], users: mutual.users ?? [] }),
    () => {
      // only this request's own entry goes; a newer one stays
      if (cache.get(key) === entry) cache.delete(key);
      return null;
    },
  );
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > MAX_PEOPLE) cache.delete(cache.keys().next().value!);
  return entry.list;
}

/** Forget every list (sign-out, tests) */
export function clearMutualCache() {
  cache.clear();
}
