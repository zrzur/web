import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countryFlagCode } from "../../ui/countryFlags";
import mapping from "../../ui/emojiMapping.json";
import flags from "./bundledFlags.json";
import { flagAssetKey } from "./flagAsset";

describe("Local flag emoji fallback", () => {
  it("covers every offered country flag without shipping excluded flags", () => {
    const entries = mapping.filter((e) => countryFlagCode(e[0]));
    expect(entries.length).toBe(194);
    for (const [emoji] of entries)
      expect(flagAssetKey(emoji), emoji).toBeTruthy();
  });
  it("ships every referenced asset locally", () => {
    for (const key of Object.keys(flags))
      expect(
        existsSync(
          fileURLToPath(
            new URL(
              `../../../public/emoji/flags-twemoji-14.0.2/${key}.svg`,
              import.meta.url,
            ),
          ),
        ),
        key,
      ).toBe(true);
  });
  it("resolves flags and pack-prefixed flags without changing ordinary letters", () => {
    expect(flagAssetKey("🇻🇳")).toBe("1f1fb-1f1f3");
    expect(flagAssetKey("\u200c🇦")).toBeUndefined();
    expect(flagAssetKey("\uE0E2🇸🇾")).toBe("1f1f8-1f1fe");
    expect(flagAssetKey("🇨🇶")).toBeUndefined();
    for (const text of [
      "VN",
      "A",
      "hello",
      "😀",
      "https://example.test",
      "🇻🇳🇸🇾",
    ])
      expect(flagAssetKey(text)).toBeUndefined();
  });
});
