import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BADGE_ART } from "./badgeArt";
import {
  ANNIVERSARY_BADGES,
  BADGES,
  BADGE_BITS,
  BADGE_SIZES,
  CONTEXT_BADGES,
  anniversaryYears,
  badgeMeta,
  badgesFromBits,
  fullYears,
} from "./catalog";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory()) return walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("badge catalogue", () => {
  it("gives every badge its own bit", () => {
    const bits = BADGES.map((badge) => badge.bit);
    expect(new Set(bits).size).toBe(bits.length);
    for (const bit of bits) expect(bit & (bit - 1)).toBe(0);
  });

  it("matches the backend UserBadges bits", () => {
    // crates/core/models/src/v0/users.rs
    expect(BADGE_BITS).toMatchObject({
      developer: 1,
      founder: 16,
      platform_moderator: 32,
      early_adopter: 256,
      plus: 2048,
      creator: 4096,
      super_creator: 8192,
      bug_hunter: 16384,
      elite_bug_hunter: 32768,
      beta_tester: 65536,
      beta_veteran: 131072,
      staff: 262144,
      partner: 524288,
      one_year: 1048576,
      three_years: 2097152,
      community_builder: 4194304,
      big_community: 8388608,
      verified_server_owner: 16777216,
      verified_bot_developer: 33554432,
      community_helper: 134217728,
    });
  });

  it("keeps Saha Champion retired: no badge, no art, its bit never shown", () => {
    expect(badgeMeta("saha_champion")).toBeUndefined();
    expect(BADGE_ART).not.toHaveProperty("saha_champion");
    expect(BADGE_ART).not.toHaveProperty("verified_creator");
    expect(badgesFromBits(67108864)).toEqual([]);
    expect(Object.values(BADGE_BITS)).not.toContain(67108864);
  });

  it("orders a bitfield by priority, rarest first", () => {
    const bits = BADGE_BITS.creator | BADGE_BITS.staff | BADGE_BITS.plus;
    expect(badgesFromBits(bits).map((badge) => badge.id)).toEqual([
      "staff",
      "creator",
      "plus",
    ]);
  });

  it("ignores unknown bits and shows nothing for zero", () => {
    expect(badgesFromBits(0)).toEqual([]);
    expect(badgesFromBits(1 << 30)).toEqual([]);
  });

  it("keeps the Feather gradient for Feather (plus) only", () => {
    const feather = ["#D92654", "#AD1A40"];
    const isFeather = (colour: string) =>
      feather.includes(colour.toUpperCase());
    for (const badge of BADGES) {
      if (badge.id !== "plus")
        expect(badge.colours.some(isFeather)).toBe(false);
    }
    expect(badgeMeta("plus")!.colours).toEqual(feather);
  });

  it("never uses forbidden brand colours", () => {
    const forbidden = ["#00D8FF", "#5865F2", "#FF005C", "#1D874B"];
    for (const badge of [...BADGES, ...CONTEXT_BADGES]) {
      for (const colour of [...badge.colours, badge.ring ?? ""]) {
        expect(forbidden).not.toContain(colour.toUpperCase());
      }
    }
  });

  it("has one size scale, on the 4 px grid", () => {
    expect(BADGE_SIZES).toEqual({
      xs: 16,
      sm: 20,
      card: 24,
      md: 32,
      lg: 40,
      xl: 48,
    });
    for (const size of Object.values(BADGE_SIZES)) expect(size % 4).toBe(0);
  });

  it("gives every badge two colour stops, lit first", () => {
    for (const badge of [...BADGES, ...CONTEXT_BADGES]) {
      expect(badge.colours).toHaveLength(2);
    }
  });

  it("keeps contextual badges out of the bitfield", () => {
    expect(CONTEXT_BADGES.map((badge) => badge.id)).toEqual([
      "server_owner",
      "server_official",
      "server_verified",
      "bot_verified",
    ]);
    for (const badge of CONTEXT_BADGES) {
      expect(badge.bit).toBe(0);
      expect(badgeMeta(badge.id)).toBe(badge);
    }
    expect(badgesFromBits(0xffffffff).map((b) => b.id)).not.toContain(
      "server_owner",
    );
  });

  it("is the only way to draw a badge: no other art outside this folder", () => {
    const root = resolve(__dirname, "../../../../..");
    const files = walk(resolve(root, "app"))
      .concat(walk(resolve(root, "modal")))
      .concat(walk(resolve(root, "ui")))
      .concat(walk(resolve(root, "../src")));
    const offenders = files.filter((file) => {
      if (file.includes("/profiles/badges/")) return false;
      const code = readFileSync(file, "utf8");
      return (
        code.includes("badges/BadgeGlyph") || code.includes("badges/essential/")
      );
    });
    expect(offenders).toEqual([]);
  });

  it("has art and a meta for every anniversary from one to ten years", () => {
    const ids = [
      "one_year",
      "three_years",
      ...ANNIVERSARY_BADGES.map((b) => b.id),
    ];
    expect(ids).toHaveLength(10);
    for (const id of ids) {
      expect(BADGE_ART).toHaveProperty(id);
      expect(badgeMeta(id)?.id).toBe(id);
    }
    for (const badge of ANNIVERSARY_BADGES) expect(badge.bit).toBe(0);
  });

  it("gives each top-tier badge a shape and ring of its own", () => {
    const top = BADGES.filter((b) => b.tier === 2);
    expect(new Set(top.map((badge) => badge.shape)).size).toBe(top.length);
    for (const badge of top) expect(badge.ring).toBeTruthy();
  });
});

describe("time on Zrzur", () => {
  const utc = (y: number, m: number, d: number, h = 0) =>
    Date.UTC(y, m - 1, d, h);

  it("counts full calendar years in UTC, as the server does", () => {
    const made = utc(2026, 11, 24, 10);
    expect(fullYears(made, made)).toBe(0);
    expect(fullYears(made, utc(2027, 11, 24, 10) - 1)).toBe(0);
    expect(fullYears(made, utc(2027, 11, 24, 10))).toBe(1);
    expect(fullYears(made, utc(2036, 11, 24, 10))).toBe(10);
    // 365 days are not a year when a 29 February lies between
    const cutoff = utc(2027, 3, 1);
    expect(cutoff).toBe(1803859200000);
    expect(fullYears(cutoff, cutoff + 365 * 86400000)).toBe(0);
    expect(fullYears(cutoff, cutoff + 366 * 86400000)).toBe(1);
  });

  it("gives a 29 February account its day on 28 February", () => {
    const made = utc(2028, 2, 29, 10);
    expect(fullYears(made, utc(2029, 2, 28, 10) - 1)).toBe(0);
    expect(fullYears(made, utc(2029, 2, 28, 10))).toBe(1);
    expect(fullYears(made, utc(2032, 2, 29, 10) - 1)).toBe(3);
    expect(fullYears(made, utc(2032, 2, 29, 10))).toBe(4);
    expect(fullYears(utc(2096, 2, 29), utc(2100, 2, 28))).toBe(4);
  });

  it("shows only the highest year, within what the bits allow", () => {
    const made = utc(2026, 1, 1);
    const one = BADGE_BITS.one_year;
    const three = BADGE_BITS.three_years;
    const ids = (bits: number, now: number) =>
      badgesFromBits(bits, made, now).map((b) => b.id);
    expect(ids(0, utc(2031, 6, 1))).toEqual([]);
    expect(ids(one, utc(2027, 6, 1))).toEqual(["one_year"]);
    expect(ids(one, utc(2028, 6, 1))).toEqual(["years_2"]);
    expect(ids(one | three, utc(2029, 6, 1))).toEqual(["three_years"]);
    expect(ids(one | three, utc(2031, 6, 1))).toEqual(["years_5"]);
    expect(ids(one | three, utc(2045, 6, 1))).toEqual(["years_10"]);
    expect(ids(one | three | BADGE_BITS.staff, utc(2032, 6, 1))).toEqual([
      "staff",
      "years_6",
    ]);
    // a clock far ahead never shows more than the server allows
    expect(ids(one, utc(2040, 1, 1))).toEqual(["years_2"]);
    // a clock behind never shows less than the bits say
    expect(anniversaryYears(one | three, made, utc(2026, 6, 1))).toBe(3);
    // without the creation time the bits alone decide
    expect(badgesFromBits(one | three).map((b) => b.id)).toEqual([
      "three_years",
    ]);
  });
});
