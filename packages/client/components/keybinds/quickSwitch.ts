/**
 * The quick switcher (Ctrl+K, ⌘K on a Mac): one search over the places a
 * person can go — channels, conversations, servers and friends. Names are
 * matched folded (alef forms, tatweel, ta marbuta and ha, case, accents),
 * so «اسامة» finds «أسامة». A first character narrows the kind:
 * # channels, @ people and conversations, * servers.
 */
import { foldText, textMatches } from "../common/lib/arabicFold";

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
};

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

/**
 * The results in order. With nothing typed: recent places first (most
 * recent first), then places with mentions, then unread ones, then the
 * latest activity. With text: names that start with it, then names that
 * contain it, then places matched by their second line; ties go to the
 * recent and the latest.
 * @param recents Ids of places visited, most recent first
 */
export function rankItems(
  items: Iterable<SwitchItem>,
  query: string,
  recents: string[] = [],
  limit = 30,
): SwitchItem[] {
  const { kinds, text } = parseQuery(query);
  const needle = foldText(text);
  const recent = new Map(recents.map((id, index) => [id, index]));
  const scored: { item: SwitchItem; score: number }[] = [];

  for (const item of items) {
    if (kinds && !kinds.includes(item.kind)) continue;
    let score = 0;
    if (needle) {
      const name = foldText(item.name);
      if (name.startsWith(needle)) score = 0;
      else if (textMatches(item.name, text)) score = 1;
      else if (item.place && textMatches(`${item.name} ${item.place}`, text))
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

/** Next selected index for ↑ / ↓, staying inside the list */
export function stepSelection(length: number, at: number, step: 1 | -1) {
  if (!length) return -1;
  if (at < 0) return step > 0 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, at + step));
}

// ------------------------------------------------------------ recent places

const KEY = "zrzur:recent-places";
const MAX = 12;
const ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** The place an address stands for: a channel, or a server without one */
export function placeFromPath(pathname: string): string | undefined {
  const channel = /\/channel\/([0-9A-HJKMNP-TV-Z]{26})/.exec(pathname)?.[1];
  if (channel) return channel;
  return /^\/server\/([0-9A-HJKMNP-TV-Z]{26})\/?$/.exec(pathname)?.[1];
}

/** Ids of places visited, most recent first (this device only) */
export function recentPlaces(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((id) => typeof id === "string" && ID.test(id))
      : [];
  } catch {
    return [];
  }
}

/** Remember a visit (the app calls this on every navigation) */
export function notePlace(pathname: string) {
  const id = placeFromPath(pathname);
  if (!id) return;
  try {
    const next = [id, ...recentPlaces().filter((other) => other !== id)];
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    // private mode or full storage: recent places are a convenience
  }
}
