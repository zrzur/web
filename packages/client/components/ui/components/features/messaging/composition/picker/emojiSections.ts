import { countryFlagCode } from "../../../../../countryFlags";
import emojiMapping from "../../../../../emojiMapping.json";
import { EMOJI_MAP_DEDUPE, EmojiDefinition } from "../../../../../emojis";

export type EmojiCategoryId =
  | "people"
  | "nature"
  | "food"
  | "travel"
  | "activities"
  | "objects"
  | "symbols"
  | "flags";

/**
 * Where each category starts in the bundled mapping (by shorthand). The
 * mapping keeps the usual emoji order, so a category runs until the next
 * one starts.
 */
const CATEGORY_STARTS: [EmojiCategoryId, string][] = [
  ["people", "smile"],
  ["nature", "bouquet"],
  ["food", "strawberry"],
  ["travel", "stop-sign"],
  ["activities", "party-popper"],
  ["objects", "camera"],
  ["symbols", "red-circle"],
  ["flags", "chequered-flag"],
];

/** Shown first under Flags: the Arab League states */
const ARAB_COUNTRIES = [
  "PS",
  "SA",
  "AE",
  "EG",
  "SY",
  "JO",
  "LB",
  "IQ",
  "KW",
  "QA",
  "BH",
  "OM",
  "YE",
  "DZ",
  "MA",
  "TN",
  "LY",
  "SD",
  "MR",
  "SO",
  "DJ",
  "KM",
];

/** A spare first codepoint used for letters, not useful to pick */
const isRegionalLetter = (emoji: string) => {
  const points = [...emoji].map((c) => c.codePointAt(0)!);
  return points.length === 1 && points[0] >= 0x1f1e6 && points[0] <= 0x1f1ff;
};

/**
 * Every emoji grouped into picker categories, in the usual order. Flags
 * are the offered country flags only, Arab countries first.
 */
export const EMOJI_CATEGORIES: {
  id: EmojiCategoryId;
  emoji: EmojiDefinition[];
}[] = (() => {
  const firstPosition = new Map<string, number>();
  emojiMapping.forEach((entry, index) => {
    if (!firstPosition.has(entry[0])) firstPosition.set(entry[0], index);
  });
  // some emoji appear twice in the mapping (🎉 also sits among the
  // smileys), so look for each start after the previous one
  let previous = -1;
  const starts = CATEGORY_STARTS.map(([id, name]) => {
    const at = emojiMapping.findIndex(
      (entry, index) => index > previous && entry.slice(1).includes(name),
    );
    if (at >= 0) previous = at;
    return { id, at };
  });

  const groups = new Map<EmojiCategoryId, EmojiDefinition[]>(
    starts.map(({ id }) => [id, []]),
  );
  for (const emoji of EMOJI_MAP_DEDUPE) {
    if (isRegionalLetter(emoji.emoji)) continue;
    const position = firstPosition.get(emoji.emoji) ?? -1;
    let category: EmojiCategoryId | undefined;
    for (const start of starts)
      if (start.at >= 0 && position >= start.at) category = start.id;
    if (category) groups.get(category)!.push(emoji);
  }

  // flags: offered countries only, Arab countries first
  const flags = groups
    .get("flags")!
    .filter((emoji) => countryFlagCode(emoji.emoji));
  const arab = (emoji: EmojiDefinition) =>
    ARAB_COUNTRIES.indexOf(countryFlagCode(emoji.emoji)!);
  groups.set("flags", [
    ...flags
      .filter((emoji) => arab(emoji) >= 0)
      .sort((a, b) => arab(a) - arab(b)),
    ...flags.filter((emoji) => arab(emoji) < 0),
  ]);

  return starts.map(({ id }) => ({ id, emoji: groups.get(id)! }));
})();
