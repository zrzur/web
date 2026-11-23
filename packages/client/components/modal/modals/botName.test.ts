import { describe, expect, it } from "vitest";

import { botNameProblem, isBotNameFormatError } from "./botName";

describe("bot names", () => {
  it("takes words with single spaces, in any script", () => {
    for (const name of [
      "Liro Bot",
      "Plainbot",
      "زرزور بوت",
      "a_b.c-d e",
      "Bot 2",
    ])
      expect(botNameProblem(name)).toBeUndefined();
  });

  it("takes every decimal digit, as the server does", () => {
    expect(botNameProblem("بوت ٢")).toBeUndefined();
    expect(botNameProblem("Bot ۳")).toBeUndefined();
  });

  it("says what is wrong as the person types", () => {
    expect(botNameProblem("")).toBeUndefined();
    expect(botNameProblem("L")).toBe("length");
    expect(botNameProblem("x".repeat(33))).toBe("length");
    expect(botNameProblem("Liro  Bot")).toBe("space");
    expect(botNameProblem(" Liro")).toBe("space");
    expect(botNameProblem("Liro ")).toBe("space");
    expect(botNameProblem("Liro​Bot")).toBe("character");
    expect(botNameProblem("Liro!")).toBe("character");
  });

  it("knows the server's format error for the name", () => {
    expect(
      isBotNameFormatError({
        type: "FailedValidation",
        fields: [{ field: "name", rule: "format" }],
      }),
    ).toBe(true);
    expect(
      isBotNameFormatError({
        type: "FailedValidation",
        fields: [{ field: "name", rule: "length" }],
      }),
    ).toBe(false);
    expect(isBotNameFormatError(new Error("x"))).toBe(false);
  });
});
