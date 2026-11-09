import { describe, expect, it } from "vitest";

import {
  commandsIn,
  findLocal,
  listedCommands,
  mergeResults,
  normalise,
  once,
  score,
} from "./find";

const item = (
  id: string,
  name: string,
  description = "",
  tags: string[] = [],
) => ({
  id,
  name,
  description,
  tags,
});

describe("Discover search on the page", () => {
  it("matches Arabic as people type it", () => {
    expect(normalise("أَلعاب")).toBe(normalise("العاب"));
    expect(normalise("مكتبة")).toBe(normalise("مكتبه"));
    expect(normalise("مصطفى")).toBe(normalise("مصطفي"));
    expect(score(item("1", "ربع الحارة"), "الحاره")).toBeGreaterThan(0);
  });

  it("ignores case and German accents' forms", () => {
    expect(score(item("1", "Müller Runde"), "MÜLLER")).toBeGreaterThan(0);
  });

  it("needs every word", () => {
    expect(score(item("1", "Chess club"), "chess go")).toBe(0);
    expect(score(item("1", "Chess club"), "club chess")).toBeGreaterThan(0);
  });

  it("finds tags, with or without the hash", () => {
    const tagged = item("1", "Nights", "", ["ورق"]);
    expect(score(tagged, "ورق")).toBeGreaterThan(0);
    expect(score(tagged, "#ورق")).toBeGreaterThan(0);
  });

  it("puts names before descriptions and keeps each listing once", () => {
    const found = findLocal(
      [
        item("a", "Quiet place", "for chess"),
        item("b", "Chess nights"),
        item("b", "Chess nights"),
      ],
      "chess",
    );
    expect(found.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("finds nothing for an empty search", () => {
    expect(findLocal([item("a", "Anything")], "   ")).toEqual([]);
  });

  it("keeps the API's order and adds what only the page knew", () => {
    expect(
      mergeResults([{ id: "b" }, { id: "a" }], [{ id: "a" }, { id: "c" }]).map(
        (x) => x.id,
      ),
    ).toEqual(["b", "a", "c"]);
  });

  it("shows a listing once across sections", () => {
    const seen = new Set<string>();
    expect(once([{ id: "a" }, { id: "b" }], seen)).toHaveLength(2);
    expect(once([{ id: "a" }, { id: "c" }], seen)).toEqual([{ id: "c" }]);
  });
});

describe("commands a bot's description mentions", () => {
  it("reads slash commands, in any script", () => {
    expect(commandsIn("Use /play and /skip, or /تشغيل.")).toEqual([
      "play",
      "skip",
      "تشغيل",
    ]);
    expect(commandsIn("/help first")).toEqual(["help"]);
  });

  it("reads the Arabic and-prefix written on to a command", () => {
    expect(commandsIn("استخدم /تحذير و/حظر")).toEqual(["تحذير", "حظر"]);
  });

  it("leaves addresses and paths alone", () => {
    expect(
      commandsIn("See https://a.example/docs and and/or /usr/bin or /a.b"),
    ).toEqual([]);
  });

  it("lists each once, up to the limit", () => {
    expect(commandsIn("/aa /aa /bb /cc", 2)).toEqual(["aa", "bb"]);
  });

  it("handles no description", () => {
    expect(commandsIn(undefined)).toEqual([]);
  });
});

describe("listedCommands", () => {
  const registered = [
    { name: "play", description: "Play a song", type: "ChatInput" },
    {
      name: "skip",
      description: "Skip",
      description_localizations: { ar: "تخطَّ", de: "Überspringen" },
      type: "ChatInput",
    },
    { name: "Report", description: "", type: "Message" },
  ];

  it("shows the bot's registered slash commands, not words from its description", () => {
    const shown = listedCommands(registered, "Try /fake", "de");
    expect(shown.source).toBe("registered");
    expect(shown.items).toEqual([
      { name: "play", description: "Play a song" },
      { name: "skip", description: "Überspringen" },
    ]);
  });

  it("an empty registered list means no commands, not a guess", () => {
    expect(listedCommands([], "Use /play", "en")).toEqual({
      source: "registered",
      items: [],
    });
  });

  it("falls back to the description only when the list could not be read", () => {
    expect(listedCommands(undefined, "Use /play", "en")).toEqual({
      source: "description",
      items: [{ name: "play" }],
    });
  });
});
