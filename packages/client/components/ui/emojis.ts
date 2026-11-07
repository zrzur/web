import { isOfferedEmoji } from "./countryFlags";
import emojiMapping from "./emojiMapping.json";

export type EmojiDefinition = {
  emoji: string;
  shorthands: string[];
};

export const EMOJI_MAP: EmojiDefinition[] = [];
export const EMOJI_MAP_DEDUPE: EmojiDefinition[] = [];
export const EMOJI_KEYS: Set<string> = new Set();
export const SHORTHAND_TO_EMOJI: Record<string, EmojiDefinition> = {};
export const MAPPED_EMOJI_KEYS: {
  id: string;
  name: string;
}[] = [];

const seenEmoji = new Set<string>();
for (let i = 0; i < emojiMapping.length; i++) {
  if (!isOfferedEmoji(emojiMapping[i][0])) continue;
  const shorthands = emojiMapping[i].slice(1);
  const ed: EmojiDefinition = {
    emoji: emojiMapping[i][0],
    shorthands: shorthands,
  };
  EMOJI_MAP.push(ed);
  if (!seenEmoji.has(ed.emoji)) {
    seenEmoji.add(ed.emoji);
    EMOJI_MAP_DEDUPE.push(ed);
  }
  for (let j = 0; j < shorthands.length; j++) {
    EMOJI_KEYS.add(shorthands[j]);
    SHORTHAND_TO_EMOJI[shorthands[j]] = ed;
    MAPPED_EMOJI_KEYS.push({ id: shorthands[j], name: shorthands[j] });
  }
}

const searchIndex = EMOJI_MAP_DEDUPE.map((emoji) => ({
  emoji,
  text: emoji.shorthands.join("\n").toLowerCase(),
}));
export function searchEmoji(query: string): EmojiDefinition[] {
  const needle = query.trim().toLowerCase();
  return searchIndex
    .filter((entry) => entry.text.includes(needle))
    .map((entry) => entry.emoji);
}

export function getEmojiByShorthand(sh: string): EmojiDefinition | undefined {
  return SHORTHAND_TO_EMOJI[sh];
}
