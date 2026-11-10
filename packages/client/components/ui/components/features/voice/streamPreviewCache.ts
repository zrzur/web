/**
 * Stream previews already fetched, so hovering a share again within 30
 * seconds shows the same still without asking the server (the sharer sends
 * a new one at most that often anyway).
 */

/** How long a fetched still is good for */
export const PREVIEW_FRESH_MS = 30_000;

/** Stills kept at once (each is a few KB) */
const MAX_ENTRIES = 32;

type Entry = { at: number; url: Promise<string | undefined> };

const entries = new Map<string, Entry>();

/**
 * The still of a share, from memory while it is fresh
 * @param channelId Voice channel
 * @param userId Sharer
 * @param fetch Asks the server (a data: URL, or undefined)
 * @param now Clock (tests)
 */
export function previewOf(
  channelId: string,
  userId: string,
  fetch: () => Promise<string | undefined>,
  now = Date.now(),
): Promise<string | undefined> {
  const key = `${channelId}:${userId}`;
  const known = entries.get(key);
  if (known && now - known.at < PREVIEW_FRESH_MS) return known.url;

  const url = fetch().catch(() => undefined);
  entries.delete(key);
  entries.set(key, { at: now, url });
  while (entries.size > MAX_ENTRIES) {
    entries.delete(entries.keys().next().value as string);
  }
  return url;
}

/** Forget every still (tests, logging out) */
export function clearPreviews() {
  entries.clear();
}
