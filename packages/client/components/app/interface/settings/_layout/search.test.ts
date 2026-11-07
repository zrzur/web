import { describe, expect, it } from "vitest";

import { matchesSearch } from "./search";

describe("settings search", () => {
  it("matches every page when nothing is typed", () => {
    expect(matchesSearch("Bans", "")).toBe(true);
    expect(matchesSearch(undefined, "   ")).toBe(true);
  });

  it("ignores case and needs every word", () => {
    expect(matchesSearch("Emergency pause invites", "PAUSE")).toBe(true);
    expect(matchesSearch("Emergency pause invites", "pause invites")).toBe(
      true,
    );
    expect(matchesSearch("Emergency pause invites", "pause roles")).toBe(false);
  });

  it("folds Arabic letter forms and diacritics", () => {
    expect(matchesSearch("الإشعارات والأعضاء", "الاعضاء")).toBe(true);
    expect(matchesSearch("الدعوات", "الدَّعوات")).toBe(true);
    expect(matchesSearch("رسالة الترحيب", "رساله")).toBe(true);
  });

  it("folds German umlauts to their base letter", () => {
    expect(matchesSearch("Kanäle", "kanale")).toBe(true);
  });
});
