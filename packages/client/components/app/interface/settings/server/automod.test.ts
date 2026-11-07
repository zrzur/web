import { describe, expect, it } from "vitest";

import {
  draftProblem,
  INSULT_WORDS,
  INSULTS_RULE_ID,
  insultsRule,
  newRule,
  parseList,
  upsertRule,
} from "./automod";

describe("AutoMod drafts", () => {
  it("reads lists one per line or comma separated, Arabic comma too", () => {
    expect(parseList("spam\n free nitro ,scam*،  احتيال\n\n")).toEqual([
      "spam",
      "free nitro",
      "scam*",
      "احتيال",
    ]);
  });

  it("gives new rules a free id and a block action", () => {
    const first = newRule("Keywords", []);
    const second = newRule("MentionSpam", [first]);
    expect(first.id).not.toBe(second.id);
    expect(second.actions.block).toBe(true);
  });

  it("says what is missing before saving", () => {
    const rule = newRule("Keywords", []);
    expect(draftProblem(rule)).toBe("name");
    rule.name = "Bad words";
    expect(draftProblem(rule)).toBe("words");
    rule.trigger = { type: "Keywords", words: ["spam"] };
    expect(draftProblem(rule)).toBeUndefined();
    rule.actions = {};
    expect(draftProblem(rule)).toBe("action");

    const links = newRule("LinkSpam", []);
    links.name = "Links";
    links.trigger = { type: "LinkSpam", allowed_domains: [] };
    expect(draftProblem(links)).toBe("links");
  });

  it("replaces an edited rule in place", () => {
    const a = { ...newRule("Keywords", []), name: "a" };
    const b = { ...newRule("MentionSpam", [a]), name: "b" };
    expect(upsertRule([a, b], { ...a, name: "A" }).map((r) => r.name)).toEqual([
      "A",
      "b",
    ]);
    expect(upsertRule([a], b)).toHaveLength(2);
  });
});

describe("the optional insults list", () => {
  it("is an ordinary rule that blocks, with a fixed id", () => {
    const rule = insultsRule("Arabic insults");
    expect(rule.id).toBe(INSULTS_RULE_ID);
    expect(rule.enabled).toBe(true);
    expect(rule.actions.block).toBe(true);
    expect(rule.trigger).toEqual({
      type: "Keywords",
      words: INSULT_WORDS,
      allow: [],
    });
  });
});
