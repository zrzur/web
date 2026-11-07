/**
 * Fold text for the settings search: case, Arabic diacritics and tatweel,
 * and the different forms of alef and yeh/teh marbuta, so people find a
 * page however they type the word
 * @param text Any text
 */
export function foldForSearch(text: string) {
  return text
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

/**
 * Whether a settings page matches what was typed: every word typed must
 * appear in the page's keywords
 * @param keywords The page's name and settings
 * @param query What was typed
 */
export function matchesSearch(keywords: string | undefined, query: string) {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = foldForSearch(keywords ?? "");
  return words.every((word) => haystack.includes(word));
}
