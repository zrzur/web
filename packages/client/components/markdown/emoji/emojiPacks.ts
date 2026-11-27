// The names only: settings read these at start-up, the emoji code loads later

/**
 * Emoji styles: the device's own emoji (the default, nothing to download)
 * or Twitter's Twemoji, bundled with the app (owner, 2026-11-27: these two
 * only)
 */
export type UnicodeEmojiPacks = "system" | "twemoji";

export const UNICODE_EMOJI_PACKS: UnicodeEmojiPacks[] = ["system", "twemoji"];

/** The style a reader gets until they choose */
export const DEFAULT_EMOJI_PACK: UnicodeEmojiPacks = "system";

let current: UnicodeEmojiPacks = DEFAULT_EMOJI_PACK;

/** The reader's style, for code outside components (the message editor) */
export const emojiStyle = () => current;

/** Kept in step with the setting by the message editor */
export function setEmojiStyle(pack: UnicodeEmojiPacks | undefined) {
  current = pack ?? DEFAULT_EMOJI_PACK;
}
