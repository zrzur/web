import { describe, expect, it } from "vitest";

import { tagEmojiFromPicker, validTagEmoji } from "./tagEmoji";

describe("stored forum tag emoji", () => {
  it("keeps real emoji and custom emoji ids", () => {
    expect(validTagEmoji("🐞")).toBe("🐞");
    expect(validTagEmoji("👩‍💻")).toBe("👩‍💻");
    expect(validTagEmoji("01JABCDEFGHJKMNPQRSTVWXYZ0")).toBe(
      "01JABCDEFGHJKMNPQRSTVWXYZ0",
    );
  });

  it("drops plain text saved before the server checked it", () => {
    expect(validTagEmoji("csc")).toBeUndefined();
    expect(validTagEmoji("c")).toBeUndefined();
    expect(validTagEmoji("🐞 bug")).toBeUndefined();
    expect(validTagEmoji("")).toBeUndefined();
    expect(validTagEmoji(undefined)).toBeUndefined();
  });
});

describe("forum tag emoji from the picker", () => {
  it("keeps the id of a custom emoji", () => {
    expect(tagEmojiFromPicker(":01JABCDEFGHJKMNPQRSTVWXYZ0:")).toBe(
      "01JABCDEFGHJKMNPQRSTVWXYZ0",
    );
  });

  it("drops the pack marker and joiner around a Unicode emoji", () => {
    expect(tagEmojiFromPicker("🐞")).toBe("🐞");
    expect(tagEmojiFromPicker("‌🇸")).toBe("🇸");
    expect(tagEmojiFromPicker("👩‍💻")).toBe("👩‍💻");
  });
});
