/**
 * The emoji picker hands over text for the message box: a custom emoji as
 * `:ID:`, a Unicode emoji with the chosen pack's marker in front (and a
 * joiner before flag letters). A forum tag stores the bare emoji or the
 * custom emoji's id, which is what the server accepts.
 * @param picked Text from the picker
 * @returns The tag's emoji
 */
export function tagEmojiFromPicker(picked: string) {
  const custom = picked.match(/^:([0-9A-HJKMNP-TV-Z]{26}):$/);
  if (custom) return custom[1];
  // pack markers U+E0E0–U+E0E6 and the zero-width non-joiner
  return picked.replace(/[\u{E0E0}-\u{E0E6}\u200C]/gu, "");
}

/**
 * A stored tag emoji, if it is one the server accepts (the same rule as the
 * API): a custom emoji id, or a short Unicode emoji. Tags saved before that
 * rule may hold plain text such as "csc"; those show no emoji.
 * @param emoji Stored value
 * @returns The emoji, or undefined
 */
export function validTagEmoji(emoji?: string | null) {
  if (!emoji) return undefined;
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(emoji)) return emoji;
  const ok =
    [...emoji].length <= 16 &&
    // eslint-disable-next-line no-control-regex
    /[^\x00-\x7F]/.test(emoji) &&
    // eslint-disable-next-line no-control-regex
    !/[A-Za-z\s\x00-\x1F\x7F]/.test(emoji);
  return ok ? emoji : undefined;
}
