import {
  ComponentProps,
  Show,
  createMemo,
  createSignal,
  splitProps,
} from "solid-js";
import { styled } from "styled-system/jsx";

import emojiRegex from "emoji-regex";

import { useState } from "@revolt/state";
import { EmojiBase } from "./EmojiBase";
import { toCodepoint } from "./codepoint";
import { type UnicodeEmojiPacks, DEFAULT_EMOJI_PACK } from "./emojiPacks";
import { flagAssetKey } from "./flagAsset";
import twemojiKeys from "./twemojiKeys.json";

export {
  type UnicodeEmojiPacks,
  DEFAULT_EMOJI_PACK,
  UNICODE_EMOJI_PACKS,
} from "./emojiPacks";

/** Every Twemoji image bundled in public/emoji/twemoji-14.0.2 */
const TWEMOJI = new Set<string>(twemojiKeys);
const TWEMOJI_BASE = `${import.meta.env.BASE_URL}emoji/twemoji-14.0.2/`;

const UNICODE_EMOJI_REGIONAL_INDICATORS =
  "\u{1f1e6}|\u{1f1e7}|\u{1f1e8}|\u{1f1e9}|\u{1f1ea}|\u{1f1eb}|\u{1f1ec}|\u{1f1ed}|\u{1f1ee}|\u{1f1ef}|\u{1f1f0}|\u{1f1f1}|\u{1f1f2}|\u{1f1f3}|\u{1f1f4}|\u{1f1f5}|\u{1f1f6}|\u{1f1f7}|\u{1f1f8}|\u{1f1f9}|\u{1f1fa}|\u{1f1fb}|\u{1f1fc}|\u{1f1fd}|\u{1f1fe}|\u{1f1ff}";

export const UNICODE_EMOJI_MIN_PACK = "\uE0E0".codePointAt(0)!;
export const UNICODE_EMOJI_MAX_PACK = "\uE0E6".codePointAt(0)!;
export const UNICODE_ZWNJ = "\u200C";

/**
 * Regex for matching emoji
 */
export const RE_UNICODE_EMOJI = new RegExp(
  `([\uE0E0-\uE0E6]?(?:${emojiRegex().source}|(?:${UNICODE_ZWNJ}?(?:${UNICODE_EMOJI_REGIONAL_INDICATORS}))))`,
  "g",
);

// Older messages carry a mark (U+E0E0 to U+E0E6) for the style their
// sender used. It is read and dropped: every reader sees emoji in the style
// they chose themselves.

export const startsWithPackPUA = (emoji: string) => {
  if (emoji.startsWith(":")) return false;
  if (emoji.slice(0, 1).match("[\uE0E0-\uE0E6]")) return true;

  return false;
};

const RE_UNICODE_EMOJI_REGIONAL_INDICATOR = new RegExp(
  `^(?:${UNICODE_EMOJI_REGIONAL_INDICATORS})$`,
);

export const isRegionalIndicator = (emoji: string): boolean => {
  return !!emoji.match(RE_UNICODE_EMOJI_REGIONAL_INDICATOR);
};

/**
 * The Twemoji file of an emoji: Twemoji names a file by its code points,
 * with the variation selector (fe0f) left out except in joined sequences
 * (as twemoji's own parser does); both spellings are tried
 */
export function twemojiKey(text: string): string | undefined {
  const full = toCodepoint(text);
  if (TWEMOJI.has(full)) return full;
  const bare = full
    .split("-")
    .filter((part) => part !== "fe0f")
    .join("-");
  return TWEMOJI.has(bare) ? bare : undefined;
}

/**
 * The image of an emoji in a style, or "" to draw it with the device's own
 * emoji font. Flags are always images: Windows has no flag emoji.
 */
export function unicodeEmojiUrl(
  pack: UnicodeEmojiPacks = DEFAULT_EMOJI_PACK,
  text: string,
) {
  const flag = flagAssetKey(text);
  if (flag)
    return `${import.meta.env.BASE_URL}emoji/flags-twemoji-14.0.2/${flag}.svg?v=20261024`;
  if (pack !== "twemoji") return "";
  const key = twemojiKey(text);
  return key ? `${TWEMOJI_BASE}${key}.svg` : "";
}

/**
 * Display Unicode emoji
 */
export function UnicodeEmoji(
  props: { emoji: string; pack?: UnicodeEmojiPacks } & Omit<
    ComponentProps<typeof EmojiBase>,
    "loading" | "class" | "alt" | "draggable" | "src"
  >,
) {
  const [local, remote] = splitProps(props, ["emoji", "pack"]);
  const state = useState();
  const [failedSource, setFailedSource] = createSignal<string>();
  const source = createMemo(() =>
    unicodeEmojiUrl(
      local.pack ??
        state.settings.getValue("appearance:unicode_emoji") ??
        DEFAULT_EMOJI_PACK,
      local.emoji,
    ),
  );

  return (
    <Show
      when={source() && failedSource() !== source()}
      fallback={
        <NativeEmoji
          style={remote.style}
          class="emoji"
          role="img"
          aria-label={local.emoji}
        >
          {local.emoji}
        </NativeEmoji>
      }
    >
      <EmojiBase
        {...remote}
        loading="lazy"
        decoding="async"
        class="emoji"
        alt={local.emoji}
        draggable={false}
        src={source()}
        onError={() => setFailedSource(source())}
      />
    </Show>
  );
}

const NativeEmoji = styled("span", {
  base: {
    display: "inline-block",
    fontFamily:
      '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
    fontSize: "var(--emoji-size, 1em)",
    lineHeight: "1.25",
    paddingBlock: "0.04em",
    margin: "0 0.05em 0 0.1em",
    verticalAlign: "middle",
  },
});
