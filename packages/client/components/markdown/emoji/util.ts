import { RE_CUSTOM_EMOJI } from "@zrzur/sdk/solid";

import { MarkdownProps } from "..";
import { RE_UNICODE_EMOJI } from "./UnicodeEmoji";

/**
 * Regex for any emoji
 */
export const RE_ANY_EMOJI = new RegExp(
  RE_CUSTOM_EMOJI.source + "|" + RE_UNICODE_EMOJI.source,
  "g",
);

/**
 * Check if a piece of text is only comprised of emoji
 * @param text Text
 * @returns Whether it is only emoji
 */
export function isOnlyEmoji(text: string) {
  return text.replaceAll(RE_ANY_EMOJI, "").trim().length === 0;
}

/**
 * Inject emoji size information into a hast node
 * @param props Pass-through Markdown props
 * @param hastNode Target hast node
 */
export function injectEmojiSize(
  props: MarkdownProps,
  hastNode: { children?: { properties: Record<string, string> }[] },
) {
  const content = props.content ?? "";

  // inject emoji size information
  // (there is no first child when content renders to nothing,
  //  such as a message containing only link reference definitions)
  const properties = (
    hastNode as { children?: { properties: Record<string, string> }[] }
  ).children?.[0]?.properties;

  // inject custom property
  if (properties) {
    if (!props.disallowBigEmoji && isOnlyEmoji(content)) {
      // will always match at least one
      RE_ANY_EMOJI.lastIndex = 0;
      RE_ANY_EMOJI.exec(content);

      // large by default
      let size = "large";

      // check if we match more than one
      // if so, make it slightly smaller
      if (RE_ANY_EMOJI.exec(content)) {
        size = "medium";
      }

      properties["emojiSize"] = size;
    }
  }
}

export { toCodepoint } from "./codepoint";
