import { describe, expect, it } from "vitest";

import { plainDescription } from "./plainText";

describe("plainDescription", () => {
  it("returns an empty string for nothing", () => {
    expect(plainDescription(undefined)).toBe("");
    expect(plainDescription("   \n ")).toBe("");
  });

  it("leaves plain words as they are", () => {
    expect(plainDescription("A calm place for players.")).toBe(
      "A calm place for players.",
    );
  });

  it("takes away emphasis marks and keeps the words", () => {
    expect(plainDescription("**Official links**")).toBe("Official links");
    expect(plainDescription("a *b* ***c*** ~~d~~ `e` __f__ _g_")).toBe(
      "a b c d e f g",
    );
  });

  it("keeps underscores and stars that are not emphasis", () => {
    expect(plainDescription("use snake_case_names here")).toBe(
      "use snake_case_names here",
    );
    expect(plainDescription("2 * 3 * 4")).toBe("2 * 3 * 4");
  });

  it("takes away list marks, headings and quotes at line starts", () => {
    expect(
      plainDescription(
        "# News\n- Website: https://zrzur.com\n* Blog\n1. First\n> quoted",
      ),
    ).toBe("News Website: https://zrzur.com Blog First quoted");
  });

  it("shows a link by its words and keeps a bare address", () => {
    expect(
      plainDescription("[our site](https://zrzur.com) <https://a.b>"),
    ).toBe("our site https://a.b");
  });

  it("keeps a hidden part hidden", () => {
    expect(plainDescription("the answer is ||42||")).toBe("the answer is …");
  });

  it("leaves no raw asterisks for the official server's text", () => {
    const text = plainDescription(
      "The official Zrzur server.\n\n**Official links**\n- Website: https://zrzur.com\n- Contact: support@zrzur.com\n\nOnly links on zrzur.com are ours.",
    );
    expect(text).not.toMatch(/\*|^- /m);
    expect(text).toContain("Official links Website: https://zrzur.com");
  });

  it("works on Arabic text", () => {
    expect(plainDescription("**روابط رسمية**\n- الموقع")).toBe(
      "روابط رسمية الموقع",
    );
  });
});
