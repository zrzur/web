/**
 * The quick switcher (Ctrl+K, ⌘K on a Mac): one search over the places a
 * person can go — channels, conversations, servers and friends. Names are
 * matched folded (alef forms, tatweel, ta marbuta and ha, case, accents),
 * so «اسامة» finds «أسامة». A first character narrows the kind:
 * # channels, @ people and conversations, * servers.
 *
 * Names are folded once when the list is built; the query once per
 * keystroke.
 */
import { foldText } from "../common/lib/arabicFold";

export type SwitchKind = "channel" | "conversation" | "server" | "friend";

export type SwitchItem = {
  kind: SwitchKind;
  /** Channel, server or user id */
  id: string;
  name: string;
  /** Second line: the server of a channel, "Direct message", … */
  place?: string;
  unread: boolean;
  mentions: number;
  /** Last activity, ms */
  updatedAt: number;
  /** The name folded for search (`withFolds` fills it) */
  folded?: string;
  /** Name and second line folded for search */
  foldedPlace?: string;
};

/** The item with its folded name and place, done once per list */
export function withFolds<T extends SwitchItem>(item: T): T {
  item.folded = foldText(item.name);
  item.foldedPlace = item.place
    ? `${item.folded} ${foldText(item.place)}`
    : item.folded;
  return item;
}

/** The parts of a channel the switcher checks before listing it */
type ChannelLike = {
  type: string;
  server?: unknown;
  active?: boolean;
  havePermission?: (permission: "ViewChannel") => boolean;
};

/**
 * Whether a channel may be listed: server channels only with View Channel
 * (the cache can hold channels the person can't open), direct messages only
 * when open
 */
export function channelListed(channel: ChannelLike): boolean {
  switch (channel.type) {
    case "TextChannel":
      return !!channel.server && !!channel.havePermission?.("ViewChannel");
    case "DirectMessage":
      return !!channel.active;
    case "Group":
    case "SavedMessages":
      return true;
    default:
      return false;
  }
}

const PREFIX: Record<string, SwitchKind[]> = {
  "#": ["channel"],
  "@": ["conversation", "friend"],
  "*": ["server"],
};

/** What was typed: the kinds it narrows to, and the text to look for */
export function parseQuery(query: string): {
  kinds?: SwitchKind[];
  text: string;
} {
  const trimmed = query.trimStart();
  const kinds = PREFIX[trimmed[0] ?? ""];
  return kinds
    ? { kinds, text: trimmed.slice(1).trim() }
    : { text: trimmed.trim() };
}

/** A folded word without a leading definite article (ال), if it has one */
function withoutArticle(word: string) {
  return word.length > 3 && word.startsWith("ال") ? word.slice(2) : word;
}

/** Every folded word typed is in the folded text (with or without ال) */
function hasWords(haystack: string, words: string[]) {
  return words.every(
    (word) =>
      haystack.includes(word) || haystack.includes(withoutArticle(word)),
  );
}

/**
 * The results in order. With nothing typed: recent places first (most
 * recent first), then places with mentions, then unread ones, then the
 * latest activity. With text: names that start with it, then names that
 * contain it, then places matched by their second line; ties go to the
 * recent and the latest.
 * @param recents Ids of places visited, most recent first
 */
export function rankItems<T extends SwitchItem>(
  items: Iterable<T>,
  query: string,
  recents: string[] = [],
  limit = 30,
): T[] {
  const { kinds, text } = parseQuery(query);
  const needle = foldText(text);
  const words = needle.split(" ").filter(Boolean);
  const recent = new Map(recents.map((id, index) => [id, index]));
  const scored: { item: T; score: number }[] = [];

  for (const item of items) {
    if (kinds && !kinds.includes(item.kind)) continue;
    let score = 0;
    if (needle) {
      const name = item.folded ?? foldText(item.name);
      if (name.startsWith(needle) || name.startsWith(withoutArticle(needle)))
        score = 0;
      else if (hasWords(name, words)) score = 1;
      else if (
        item.place &&
        hasWords(item.foldedPlace ?? `${name} ${foldText(item.place)}`, words)
      )
        score = 2;
      else continue;
    } else {
      score = recent.has(item.id) ? 0 : item.mentions ? 1 : item.unread ? 2 : 3;
    }
    scored.push({ item, score });
  }

  const at = (id: string) => recent.get(id) ?? Number.MAX_SAFE_INTEGER;
  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        at(a.item.id) - at(b.item.id) ||
        b.item.updatedAt - a.item.updatedAt,
    )
    .slice(0, limit)
    .map((entry) => entry.item);
}

/**
 * The chosen result after the list changed or a key moved it: the same item
 * (by id) while it is still listed, else the first
 * @param step ↑ (-1) or ↓ (1) moves from the current one
 */
export function selectedId(
  list: { id: string }[],
  current: string | undefined,
  step: 0 | 1 | -1 = 0,
): string | undefined {
  if (!list.length) return undefined;
  const at = list.findIndex((item) => item.id === current);
  if (at < 0) return list[step < 0 ? list.length - 1 : 0].id;
  return list[Math.min(list.length - 1, Math.max(0, at + step))].id;
}

// ------------------------------------------------------------ recent places

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
