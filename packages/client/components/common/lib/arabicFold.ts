/**
 * Text folded for searching and filtering, so a person finds a name or a word
 * however it was typed. Only the copy used for the comparison is folded; what
 * is stored and shown never changes.
 *
 * - case, and accents on Latin letters
 * - Arabic vowel marks (tashkeel), Quranic marks and the tatweel (ـ)
 * - every form of alef (أ إ آ ٱ ا), hamza on waw and ya (ؤ ئ)
 * - ta marbuta and ha (ة ه), alef maqsura and ya (ى ي)
 * - Persian and Urdu forms of kaf, ya and ha (ک ی ے ہ ھ)
 * - Arabic-Indic and Persian digits (٠-٩, ۰-۹) and Latin digits
 * - presentation forms and ligatures (ﻻ), invisible direction marks
 */
export function foldText(text: string): string {
  return (
    text
      .normalize("NFKD")
      // combining marks: Latin accents, tashkeel and the hamza and madda that
      // NFKD splits off alef, waw and ya, Quranic annotation marks
      .replace(
        /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,
        "",
      )
      // tatweel, and marks nobody sees: zero-width and direction controls
      .replace(
        /[\u0640\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g,
        "",
      )
      .replace(/[\u0671-\u0673\u0675]/g, "\u0627")
      .replace(/[\u0649\u06CC\u06D2\u06D3\u06CD\u06D0]/g, "\u064A")
      .replace(/[\u0629\u06C0-\u06C3\u06BE\u06D5]/g, "\u0647")
      .replace(/[\u06A9\u06AA\u063B\u063C]/g, "\u0643")
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .toLocaleLowerCase("en")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** The folded word without a leading definite article (ال), if it has one */
function withoutArticle(word: string) {
  return word.length > 3 && word.startsWith("ال") ? word.slice(2) : word;
}

/**
 * Whether what was typed is found in a text. Every word typed has to be
 * there; a word typed with the definite article also finds the text without
 * it (typing «الكتاب» finds «كتاب»; «كتاب» finds «الكتاب» as a part of it).
 * @param text Where to look (a name, a message)
 * @param query What the person typed
 */
export function textMatches(text: string | undefined | null, query: string) {
  const words = foldText(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = foldText(text ?? "");
  return words.every(
    (word) =>
      haystack.includes(word) || haystack.includes(withoutArticle(word)),
  );
}

/**
 * Whether a query has anything left to search for once folded: one made of
 * tatweel, vowel marks or invisible marks only folds to nothing, and an
 * empty query matches every name
 */
export function hasSearchText(query: string) {
  return foldText(query) !== "";
}

/** Whether any of the texts has what was typed */
export function anyTextMatches(
  texts: (string | undefined | null)[],
  query: string,
) {
  return texts.some((text) => text && textMatches(text, query));
}

const collators = new Map<string, Intl.Collator>();

/**
 * Order two names the way the interface's language orders them: in Arabic,
 * Arabic names come before Latin ones, hamza forms and vowel marks do not
 * split a letter's names apart, and digits count as numbers.
 */
export function compareNames(a: string, b: string) {
  const lang =
    (typeof document !== "undefined" && document.documentElement.lang) || "en";
  let collator = collators.get(lang);
  if (!collator) {
    collator = new Intl.Collator(lang, { numeric: true, sensitivity: "base" });
    collators.set(lang, collator);
  }
  return collator.compare(a, b) || a.localeCompare(b);
}

/**
 * The items whose text holds what was typed, folded: those that start with
 * it first, then the others, each group in name order. For lists that offer
 * names while the person types (mentions, channels, roles).
 * @param items What can be offered
 * @param typed What the person typed
 * @param textOf The text an item is found by (a name, or several joined)
 * @param nameOf The name an item is sorted by
 */
export function pickByFold<T>(
  items: readonly T[],
  typed: string,
  textOf: (item: T) => string,
  nameOf: (item: T) => string,
): T[] {
  const wanted = foldText(typed);
  if (!wanted) return [];
  const bare = withoutArticle(wanted);
  const starts: T[] = [];
  const holds: T[] = [];
  for (const item of items) {
    const text = foldText(textOf(item));
    if (text.startsWith(wanted)) starts.push(item);
    else if (text.includes(wanted) || text.includes(bare)) holds.push(item);
  }
  const byName = (a: T, b: T) => compareNames(nameOf(a), nameOf(b));
  return [...starts.sort(byName), ...holds.sort(byName)];
}
