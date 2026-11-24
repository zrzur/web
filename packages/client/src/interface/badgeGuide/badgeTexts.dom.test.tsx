import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ANNIVERSARY_BADGES,
  AnyBadgeId,
  BADGES,
  CONTEXT_BADGES,
  badgeMeta,
} from "@revolt/ui/components/features/profiles/badges/catalog";
import {
  BadgeText,
  useBadgeText,
} from "@revolt/ui/components/features/profiles/badges/useBadgeText";

import { GuideSection, useBadgeGuide } from "./useBadgeGuide";

let text: (id: string) => BadgeText;
let sections: GuideSection[];

beforeAll(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  const root = document.createElement("div");
  document.body.append(root);
  render(
    () => (
      <I18nProvider i18n={i18n}>
        {(() => {
          text = useBadgeText();
          sections = useBadgeGuide()().sections;
          return null;
        })()}
      </I18nProvider>
    ),
    root,
  );
});

const active = () => [
  ...BADGES.filter((badge) => !badge.retired),
  ...ANNIVERSARY_BADGES,
  ...CONTEXT_BADGES,
];
const entries = () => sections.flatMap((section) => section.entries);

/**
 * One source for what a badge is called, what it means and how it is earned
 * (owner, 2026-11-24: My Badges and /badges said different things). The
 * guide adds only details below the shared line.
 */
describe("badge texts: one source", () => {
  it("gives every active badge a name, a meaning, how it is earned and how it is given", () => {
    for (const badge of active()) {
      const words = text(badge.id);
      expect(words.name, badge.id).not.toBe(badge.id);
      expect(words.description, badge.id).toBeTruthy();
      expect(words.earn, badge.id).toBeTruthy();
      expect(
        ["automatic", "application", "team", "none"],
        badge.id,
      ).toContain(words.how);
    }
  });

  it("lists every active badge in the guide once, and no retired one", () => {
    const listed = entries().map((entry) => entry.id);
    expect(new Set(listed).size).toBe(listed.length);
    // the years are one entry ("Years on Zrzur", under One Year)
    for (const badge of BADGES.filter((b) => b.id !== "three_years"))
      expect(listed.includes(badge.id), badge.id).toBe(!badge.retired);
    for (const badge of CONTEXT_BADGES) expect(listed).toContain(badge.id);
  });

  it("keeps the guide's details apart from the shared line", () => {
    for (const entry of entries()) {
      const words = text(entry.id);
      expect(entry.details, entry.id).not.toContain(words.earn);
      expect(entry.details, entry.id).not.toContain(words.description);
      expect(entry).not.toHaveProperty("how");
      expect(entry).not.toHaveProperty("criteria");
    }
  });

  it("never tells people to apply while the line is shown without a button", () => {
    for (const badge of active()) {
      const words = text(badge.id);
      expect(words.earn, badge.id).not.toMatch(/\bapply\b/i);
      if (words.how === "application")
        expect(words.earn, badge.id).toMatch(
          /^By application, reviewed by the Zrzur team/,
        );
    }
  });

  it("never promises a review time", () => {
    const all = active().flatMap((badge) => {
      const words = text(badge.id);
      return [words.description, words.earn];
    });
    for (const line of [...all, ...entries().flatMap((e) => e.details)])
      expect(line).not.toMatch(
        /review(ed)? (with)?in \d|\d+ (hours|days|weeks) to review/i,
      );
  });

  it("no longer gives out Verified Server Owner, but still names it for people who have it", () => {
    // owner 2026-11-24: the badge is cancelled; the Verified Server mark stays
    expect(badgeMeta("verified_server_owner")?.retired).toBe(true);
    expect(entries().map((entry) => entry.id)).not.toContain(
      "verified_server_owner",
    );
    const words = text("verified_server_owner");
    expect(words.name).toBe("Verified Server Owner");
    expect(words.earn).toBe("");
    expect(entries().map((entry) => entry.id)).toContain("server_verified");
    expect(text("server_verified").earn).not.toContain(
      "Verified Server Owner",
    );
  });

  it("says the approved rules for Verified Server and Verified Bot Developer", () => {
    const owner = text("server_verified" as AnyBadgeId).earn;
    expect(owner).toContain("10,000");
    expect(owner).toContain("180 days");
    expect(owner).toContain("DNS");
    const developer = text("verified_bot_developer" as AnyBadgeId).earn;
    expect(developer).toContain("25");
    expect(developer).toContain("30 days");
    expect(developer).toContain("ownership");
    for (const badge of active()) {
      expect(text(badge.id).earn).not.toContain("Own a verified server");
      expect(text(badge.id).earn).not.toContain("Own a verified bot");
    }
  });
});
