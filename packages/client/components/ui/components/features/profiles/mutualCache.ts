import type { User } from "@zrzur/sdk/solid";

/** What two people share, as the server lists it */
export type Mutual = { servers: string[]; users: string[] };

/** A profile opened again within this time reuses the list */
const KEEP_MS = 60_000;
/** People remembered at once; the oldest goes first */
const MAX_PEOPLE = 50;

const cache = new Map<string, { at: number; list: Promise<Mutual | null> }>();

/**
 * The servers and friends the viewer shares with `user`, kept for a minute
 * so opening a card again asks nothing. A refusal (someone blocked, or no
 * shared connection) is `null`: nothing is shown, and nothing is kept.
 */
export function mutualFor(user: User): Promise<Mutual | null> {
  const now = Date.now();
  const kept = cache.get(user.id);
  if (kept && now - kept.at < KEEP_MS) return kept.list;

  const list = user.fetchMutual().then(
    (mutual) => ({ servers: mutual.servers ?? [], users: mutual.users ?? [] }),
    () => {
      cache.delete(user.id);
      return null;
    },
  );
  cache.delete(user.id);
  cache.set(user.id, { at: now, list });
  if (cache.size > MAX_PEOPLE) cache.delete(cache.keys().next().value!);
  return list;
}

/** Forget every list (sign-out, tests) */
export function clearMutualCache() {
  cache.clear();
}
