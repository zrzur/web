/**
 * A listing's description as plain words, for the page head and the preview
 * picture: search results and link previews show text as it is, so the
 * formatting marks (bold, lists, links) are taken away and the words stay.
 * The same rules as the app's card (client: discover/plainText.ts); keep the
 * two alike.
 * @param {string | undefined} source
 * @returns {string}
 */
export function plainDescription(source) {
  if (!source) return "";
  return (
    source
      // code fences: keep the code, drop the fence lines
      .replace(/^[ \t]*(```|~~~).*$/gm, "")
      // hidden parts stay hidden
      .replace(/\|\|[\s\S]+?\|\|/g, "…")
      // pictures and links: their words
      .replace(/!\[([^\]]*)\]\([^)\s]*(?:\s+"[^"]*")?\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)\s]*(?:\s+"[^"]*")?\)/g, "$1")
      .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, "$1")
      // line starts: headings, quotes, list marks
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
      .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
      .replace(/^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, "")
      // rules on a line of their own
      .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, "")
      // emphasis, strongest first; underscores only around whole words
      .replace(/(\*\*\*|\*\*|\*)(?=\S)([\s\S]*?\S)\1/g, "$2")
      .replace(
        /(^|[^\p{L}\p{N}_])(___|__|_)(?=\S)([\s\S]*?\S)\2(?![\p{L}\p{N}_])/gu,
        "$1$3",
      )
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "$1")
      .replace(/(`+)([^`]+?)\1/g, "$2")
      // one line of words
      .replace(/\s+/g, " ")
      .trim()
  );
}
