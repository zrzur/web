import { describe, expect, it } from "vitest";

import {
  ART_HEIGHT,
  ART_MOTIFS,
  ART_WIDTH,
  PERCHES,
  fillShare,
  hashId,
  listingArt,
} from "./artPaths";
import { CATEGORIES } from "./categories";

const dotCount = (path: string) => path.match(/h0/g)?.length ?? 0;
const coordinates = (path: string) =>
  [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)h0/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);

describe("a community's portrait", () => {
  it("has a drawing of its own for every category", () => {
    for (const kind of ["servers", "bots"] as const)
      for (const { id } of CATEGORIES[kind]) expect(ART_MOTIFS).toContain(id);
  });

  it("draws the same thing for the same listing", () => {
    expect(listingArt("servers", "gaming", "01ABC", 40, 3)).toEqual(
      listingArt("servers", "gaming", "01ABC", 40, 3),
    );
  });

  it("draws two listings of a category differently", () => {
    expect(listingArt("servers", "gaming", "01ABC", 40).birds).not.toBe(
      listingArt("servers", "gaming", "01ABD", 40).birds,
    );
  });

  it("uses every perch and stays inside the picture, in every drawing", () => {
    for (const motif of ART_MOTIFS) {
      const { perch, birds, lit } = listingArt("servers", motif, "s", 500, 20);
      const all = `${perch}${birds}${lit}`;
      expect(dotCount(all), motif).toBeGreaterThanOrEqual(PERCHES - 2);
      expect(all, motif).not.toMatch(/NaN|Infinity|undefined/);
      for (const [x, y] of coordinates(all)) {
        expect(x, motif).toBeGreaterThanOrEqual(0);
        expect(x, motif).toBeLessThanOrEqual(ART_WIDTH);
        expect(y, motif).toBeGreaterThanOrEqual(0);
        expect(y, motif).toBeLessThanOrEqual(ART_HEIGHT);
      }
    }
  });

  it("gets fuller as a community grows, and a young one still shows", () => {
    const birds = (count: number) => {
      const art = listingArt("servers", "music", "id", count);
      return dotCount(art.birds);
    };
    expect(birds(1)).toBeGreaterThan(0);
    expect(birds(50)).toBeGreaterThan(birds(5));
    expect(birds(5000)).toBeGreaterThan(birds(50));
    expect(fillShare(0)).toBeGreaterThan(0);
    expect(fillShare(10_000_000)).toBe(1);
  });

  it("lights one bird at least when anyone is online, none when nobody is", () => {
    expect(dotCount(listingArt("servers", "art", "id", 9000, 1).lit)).toBe(1);
    expect(dotCount(listingArt("servers", "art", "id", 100, 0).lit)).toBe(0);
    expect(listingArt("servers", "art", "id", 100).lit).toBe("");
  });

  it("never lights more birds than there are members drawn", () => {
    const art = listingArt("servers", "art", "id", 3, 500);
    expect(dotCount(art.birds)).toBe(0);
    expect(dotCount(art.lit)).toBeGreaterThan(0);
  });

  it("falls back to the wave for no category and unknown ones", () => {
    expect(listingArt("bots", undefined, "x").perch).not.toBe("");
    expect(listingArt("bots", "not-a-category", "x").perch).not.toBe("");
  });

  it("hashes without a sign", () => {
    expect(hashId("زرزور")).toBeGreaterThanOrEqual(0);
  });
});
