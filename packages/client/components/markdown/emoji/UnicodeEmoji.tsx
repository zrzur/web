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
import { assertAllowedServiceUrl } from "../../common/lib/env";
import { EmojiBase } from "./EmojiBase";
import bundledEmoji from "./bundledEmoji.json";
import { toCodepoint } from "./codepoint";
import type { UnicodeEmojiPacks } from "./emojiPacks";
import { flagAssetKey } from "./flagAsset";

export { UNICODE_EMOJI_PACKS, type UnicodeEmojiPacks } from "./emojiPacks";

const BUNDLED_EMOJI: Record<string, Record<string, boolean>> = bundledEmoji;
export function isEmojiPackAvailable(pack: UnicodeEmojiPacks) {
  return (
    pack === "system" ||
    !!BUNDLED_EMOJI[pack] ||
    !!import.meta.env.VITE_EMOJI_CDN?.trim()
  );
}

// openmoji is off due to incomplete implementation

export const UNICODE_EMOJI_PACK_PUA: Record<string, string> = {
  // omit fluent-3d as it is the default (canonically \uE0E1)
  "fluent-flat": "\uE0E2",
  noto: "\uE0E4",
  //  openmoji: "\uE0E5",
  twemoji: "\uE0E6",
};

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

export const UNICODE_EMOJI_PUA_PACK: Record<string, UnicodeEmojiPacks> = {
  ["\uE0E0"]: "fluent-3d", // default entry
  ["\uE0E1"]: "fluent-3d",
  ["\uE0E2"]: "fluent-flat",
  ["\uE0E3"]: "fluent-flat", // retired pack: old messages keep rendering
  ["\uE0E4"]: "noto",
  //  ["\uE0E5"]: "openmoji",
  ["\uE0E6"]: "twemoji",
};

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

export function unicodeEmojiUrl(
  pack: UnicodeEmojiPacks = "fluent-flat",
  text: string,
) {
  const flag = flagAssetKey(text);
  if (flag)
    return `${import.meta.env.BASE_URL}emoji/flags-twemoji-14.0.2/${flag}.svg?v=20261024`;
  if (pack === "system") return "";
  // Prefer configured Zrzur emoji CDN; never fall back to static.stoat.chat.
  const base = assertAllowedServiceUrl(
    import.meta.env.VITE_EMOJI_CDN as string | undefined,
    "VITE_EMOJI_CDN",
  );
  const key = toCodepoint(text)
    .split("-")
    .filter((part) => part !== "fe0f")
    .join("-");
  if (BUNDLED_EMOJI[pack]?.[key]) {
    return `${import.meta.env.BASE_URL}emoji/2.2.0/${pack}/${key}.svg`;
  }
  if (!base) {
    return "";
  }
  return `${base}/${pack}/${toCodepoint(text)}.svg?v=1`;
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
      local.pack ?? state.settings.getValue("appearance:unicode_emoji"),
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
