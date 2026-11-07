import { describe, expect, it } from "vitest";

import { matchesSearch } from "../_layout/search";
import {
  ALIASES,
  SECTIONS,
  pageKeywords,
  resolvePage,
  sectionKeywords,
  splitAddress,
} from "./registry";

describe("server settings registry", () => {
  it("opens the new page and section for every old id", () => {
    expect(resolvePage("discover")).toBe("overview#discovery");
    expect(resolvePage("lobby")).toBe("joining/lobby");
    expect(resolvePage("access/requests")).toBe("joining/requests");
    expect(resolvePage("log")).toBe("log");
    for (const target of Object.values(ALIASES)) {
      const { page, section } = splitAddress(target);
      const base = page.split("/")[0];
      const known = SECTIONS.some(
        (s) => s.page === base && (!section || s.id === section),
      );
      // pages without a matching section entry (sub-views, whole pages)
      expect(known || !section).toBe(true);
    }
  });

  it("finds sections in English, Arabic and German", () => {
    const find = (query: string) =>
      SECTIONS.filter((s) => matchesSearch(sectionKeywords(s), query)).map(
        (s) => `${s.page}#${s.id}`,
      );
    expect(find("custom invite")).toContain("overview#invites");
    expect(find("رابط دعوة")).toContain("overview#invites");
    expect(find("einladungslink")).toContain("overview#invites");
    expect(find("verification")).toContain("joining#verification");
    expect(find("التحقق")).toContain("joining#verification");
    expect(find("überprüfung")).toContain("joining#verification");
    expect(find("نقل الملكية")).toContain("overview#danger");
    expect(find("löschen")).toContain("overview#danger");
  });

  it("matches a page by anything in it", () => {
    expect(matchesSearch(pageKeywords("safety"), "automod")).toBe(true);
    expect(matchesSearch(pageKeywords("apps"), "webhooks")).toBe(true);
    expect(matchesSearch(pageKeywords("bans"), "automod")).toBe(false);
  });
});
