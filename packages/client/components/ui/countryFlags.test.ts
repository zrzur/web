import { describe, expect, it } from "vitest";
import { countryFlagCode, isOfferedEmoji } from "./countryFlags";
import { EMOJI_MAP_DEDUPE, getEmojiByShorthand, searchEmoji } from "./emojis";

describe("Country-only emoji selection", () => {
  it("includes only the selected countries in the flags category", () => {
    const flags = EMOJI_MAP_DEDUPE.filter((f) => !!countryFlagCode(f.emoji));
    expect(flags.length).toBe(194);
    for (const f of flags)
      expect(countryFlagCode(f.emoji), f.shorthands[0]).toBeTruthy();
    expect(flags.some((f) => f.emoji === "🇸🇾")).toBe(true);
    expect(flags.some((f) => f.emoji === "🇵🇸")).toBe(true);
  });
  it.each(["🇮🇱", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️", "🏳️", "🏴", "🚩", "🏁", "🇦", "🇪🇺", "🇺🇳"])(
    "does not offer removed symbol %s",
    (emoji) => {
      expect(isOfferedEmoji(emoji)).toBe(false);
      expect(EMOJI_MAP_DEDUPE.some((e) => e.emoji === emoji)).toBe(false);
    },
  );
  it("filters search and shortcode lookup too", () => {
    for (const q of [
      "rainbow-flag",
      "transgender-flag",
      "israel-flag",
      "regional-indicator-a",
    ]) {
      expect(searchEmoji(q)).toEqual([]);
      expect(getEmojiByShorthand(q)).toBeUndefined();
    }
  });
  it("preserves non-flag emoji and searchable aliases", () => {
    expect(isOfferedEmoji("😀")).toBe(true);
    expect(searchEmoji(" smile ").length).toBeGreaterThan(0);
    expect(searchEmoji("syria").some((e) => e.emoji === "🇸🇾")).toBe(true);
    expect(new Set(EMOJI_MAP_DEDUPE.map((e) => e.emoji)).size).toBe(
      EMOJI_MAP_DEDUPE.length,
    );
  });
});
