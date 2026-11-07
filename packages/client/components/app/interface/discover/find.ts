/**
 * Search on what is already on the screen, answering on the keystroke; the
 * API's answer follows and joins in. Arabic is matched the way people type
 * it: without vowel marks, any form of alef, ya or ta marbuta.
 */

type Findable = {
  id: string;
  name: string;
  description?: string;
  tags: string[];
};

export function normalise(text: string) {
  return text
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every word typed is found somewhere; the name counts most */
export function score(item: Findable, query: string) {
  const words = normalise(query).replace(/^#/, "").split(" ").filter(Boolean);
  if (!words.length) return 0;
  const name = normalise(item.name);
  const tags = item.tags.map(normalise);
  const about = normalise(item.description ?? "");
  let total = 0;
  for (const word of words) {
    if (name.startsWith(word)) total += 8;
    else if (name.includes(word)) total += 5;
    else if (tags.some((tag) => tag.startsWith(word))) total += 4;
    else if (about.includes(word)) total += 1;
    else return 0;
  }
  return total;
}

/** The items that match, best first, each one once */
export function findLocal<T extends Findable>(items: T[], query: string): T[] {
  const best = new Map<string, { item: T; points: number }>();
  for (const item of items) {
    const points = score(item, query);
    if (points && !best.has(item.id)) best.set(item.id, { item, points });
  }
  return [...best.values()]
    .sort((a, b) => b.points - a.points)
    .map((entry) => entry.item);
}

/** The API's order first, then what only this page knew about */
export function mergeResults<T extends { id: string }>(
  answered: T[],
  local: T[],
): T[] {
  const ids = new Set(answered.map((item) => item.id));
  return [...answered, ...local.filter((item) => !ids.has(item.id))];
}

/** Keeps the first time each listing appears, across lists */
export function once<T extends { id: string }>(
  items: T[],
  seen: Set<string>,
): T[] {
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Slash commands a bot's own description mentions. Discover has no public
 * command list, so this is what can honestly be shown: only the words the
 * owner wrote, and never pieces of an address.
 */
export function commandsIn(description?: string, limit = 8) {
  const found = new Set<string>();
  // after a space or bracket, or the Arabic "and" written on to the word
  const pattern =
    /(?:^|[\s(،,:;؛"«]|(?<=\s)و)\/([\p{L}\p{N}][\p{L}\p{N}_-]{1,31})(?![\p{L}\p{N}_/-]|\.[\p{L}\p{N}])/gu;
  for (const match of (description ?? "").matchAll(pattern)) {
    found.add(match[1]);
    if (found.size === limit) break;
  }
  return [...found];
}
