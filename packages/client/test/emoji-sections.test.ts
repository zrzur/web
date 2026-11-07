import { describe, expect, it } from "vitest";
import { EMOJI_CATEGORIES } from "../components/ui/components/features/messaging/composition/picker/emojiSections";
import { EMOJI_MAP_DEDUPE } from "../components/ui/emojis";

const category = (id: string) =>
  EMOJI_CATEGORIES.find((entry) => entry.id === id)!.emoji.map(
    (entry) => entry.emoji,
  );

describe("emoji picker categories", () => {
  it("has every category in the usual order", () => {
    expect(EMOJI_CATEGORIES.map((entry) => entry.id)).toEqual([
      "people",
      "nature",
      "food",
      "travel",
      "activities",
      "objects",
      "symbols",
      "flags",
    ]);
    for (const entry of EMOJI_CATEGORIES)
      expect(entry.emoji.length).toBeGreaterThan(20);
  });

  it("covers the whole set, each emoji once", () => {
    const all = EMOJI_CATEGORIES.flatMap((entry) =>
      entry.emoji.map((e) => e.emoji),
    );
    expect(new Set(all).size).toBe(all.length);
    // everything except bare regional letters and non-offered flags
    expect(all.length).toBeGreaterThan(EMOJI_MAP_DEDUPE.length - 120);
  });

  it("puts emoji in the right category", () => {
    expect(category("people")).toContain("😀");
    expect(category("people")).toContain("👍");
    expect(category("nature")).toContain("🐶");
    expect(category("food")).toContain("🍕");
    expect(category("travel")).toContain("🚗");
    expect(category("activities")).toContain("⚽");
    expect(category("objects")).toContain("💡");
    expect(category("symbols")).toContain("✅");
  });

  it("offers country flags only, Arab countries first", () => {
    const flags = category("flags");
    expect(flags.slice(0, 3)).toEqual(["🇵🇸", "🇸🇦", "🇦🇪"]);
    expect(flags).toContain("🇩🇪");
    expect(flags).toContain("🇺🇸");
    expect(flags).not.toContain("🇮🇱");
    expect(flags).not.toContain("🏳️‍🌈");
    expect(flags.length).toBe(194);
  });
});
