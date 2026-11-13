/**
 * The part of a channel's history that is loaded: one unbroken run of
 * messages, newest first, and whether each side of it reaches the channel's
 * edge. Every change to that run is one of the functions below; nothing else
 * decides "is there more above / below".
 *
 * Message ids are ULIDs: comparing them as text orders them by time.
 */
export interface HistoryWindow<T extends { id: string }> {
  /** Loaded messages, newest first, no gaps, no duplicates */
  items: T[];
  /** The oldest loaded message is the first message of the channel */
  atStart: boolean;
  /** The newest loaded message is the newest message of the channel */
  atEnd: boolean;
}

type Item = { id: string };

/** Newest first, one entry per id (the later list wins) */
function merge<T extends Item>(...lists: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) for (const item of list) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) =>
    a.id < b.id ? 1 : a.id > b.id ? -1 : 0,
  );
}

/** Nothing loaded yet */
export function emptyWindow<T extends Item>(): HistoryWindow<T> {
  return { items: [], atStart: false, atEnd: true };
}

/**
 * The newest page of a channel
 * @param page What the server answered for "the latest `limit` messages"
 */
export function fromLatest<T extends Item>(
  page: T[],
  limit: number,
): HistoryWindow<T> {
  return { items: merge(page), atStart: page.length < limit, atEnd: true };
}

/**
 * A page around one message. The server answers up to `limit / 2 + 1`
 * messages at or after the target and as many before it; a side that comes
 * back short has reached its edge of the channel.
 */
export function fromNearby<T extends Item>(
  page: T[],
  target: string,
  limit: number,
): HistoryWindow<T> {
  const half = Math.floor(limit / 2) + 1;
  const newer = page.filter((item) => item.id >= target).length;
  const older = page.length - newer;
  return { items: merge(page), atStart: older < half, atEnd: newer < half };
}

/**
 * A page of older messages, asked for with `limit`. Past `displayLimit` the
 * newest rows are dropped, and the window is then no longer live.
 * @returns The window and how many rows were dropped from the newest side
 */
export function addOlder<T extends Item>(
  window: HistoryWindow<T>,
  page: T[],
  limit: number,
  displayLimit: number,
): { window: HistoryWindow<T>; dropped: number } {
  const merged = merge(window.items, page);
  const next = dropNewest(
    { items: merged, atStart: page.length < limit, atEnd: window.atEnd },
    displayLimit,
  );
  return { window: next, dropped: merged.length - next.items.length };
}

/**
 * A page of newer messages, asked for with `limit`. Past `displayLimit` the
 * oldest rows are dropped, and the start is then no longer loaded.
 * @returns The window and how many rows were dropped from the oldest side
 */
export function addNewer<T extends Item>(
  window: HistoryWindow<T>,
  page: T[],
  limit: number,
  displayLimit: number,
): { window: HistoryWindow<T>; dropped: number } {
  const merged = merge(window.items, page);
  const next = dropOldest(
    { items: merged, atStart: window.atStart, atEnd: page.length < limit },
    displayLimit,
  );
  return { window: next, dropped: merged.length - next.items.length };
}

/**
 * A message that just arrived. It belongs to the window only while the
 * window is live; otherwise the window is returned unchanged.
 * @param options.trim Drop the oldest rows past `limit` (only while the reader is at the bottom: nothing they read may vanish)
 */
export function addLive<T extends Item>(
  window: HistoryWindow<T>,
  message: T,
  options: { trim: boolean; limit: number },
): HistoryWindow<T> {
  if (!window.atEnd) return window;
  const merged = merge(window.items, [message]);
  if (options.trim && merged.length > options.limit) {
    return {
      items: merged.slice(0, options.limit),
      atStart: false,
      atEnd: true,
    };
  }
  return { ...window, items: merged };
}

/** Deleted messages leave the window */
export function removeIds<T extends Item>(
  window: HistoryWindow<T>,
  ids: Iterable<string>,
): HistoryWindow<T> {
  const gone = new Set(ids);
  const items = window.items.filter((item) => !gone.has(item.id));
  return items.length === window.items.length ? window : { ...window, items };
}

/**
 * The connection was lost for a while: messages may have been missed, so the
 * newer side has to be asked for again (from the newest row we hold, which
 * leaves no gap).
 */
export function markStale<T extends Item>(
  window: HistoryWindow<T>,
): HistoryWindow<T> {
  return window.items.length && window.atEnd
    ? { ...window, atEnd: false }
    : window;
}

/** Keep only the newest `limit` rows of a window that is put aside */
export function trimForCache<T extends Item>(
  window: HistoryWindow<T>,
  limit: number,
): HistoryWindow<T> {
  return window.items.length > limit
    ? { ...window, items: window.items.slice(0, limit), atStart: false }
    : window;
}

/**
 * The message a jump to `target` lands on: the message itself, or the first
 * one after it when the id is not a loaded message (a point in time, or a
 * message that was deleted), or the newest one when nothing follows it.
 */
export function nearestId<T extends Item>(
  items: T[],
  target: string,
): string | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].id >= target) return items[i].id;
  }
  return items[0]?.id;
}

/**
 * Keep the oldest `limit` rows: the newest ones go, and the window is then
 * no longer live
 */
export function dropNewest<T extends Item>(
  window: HistoryWindow<T>,
  limit: number,
): HistoryWindow<T> {
  const over = window.items.length - limit;
  return over > 0
    ? { ...window, items: window.items.slice(over), atEnd: false }
    : window;
}

/**
 * Keep the newest `limit` rows: the oldest ones go, and the start of the
 * channel is then no longer loaded
 */
export function dropOldest<T extends Item>(
  window: HistoryWindow<T>,
  limit: number,
): HistoryWindow<T> {
  return window.items.length > limit
    ? { ...window, items: window.items.slice(0, limit), atStart: false }
    : window;
}
