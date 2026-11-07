import { describe, expect, it } from "vitest";

import { isPaidListing, listingMark } from "./marks";

describe("paid placements are always labelled as ads", () => {
  const paid = [
    { name: "Boost (Boosted)", listing: { boost: "Boost" as const } },
    {
      name: "SuperBoost (Spotlight)",
      listing: { boost: "SuperBoost" as const },
    },
    { name: "MegaBoost (Headline)", listing: { boost: "MegaBoost" as const } },
    { name: "top row (Promoted)", listing: { promoted: true } },
    {
      name: "boost that is also hand-picked",
      listing: { boost: "Boost" as const, featured: true },
    },
  ];

  for (const { name, listing } of paid) {
    it(`${name} gets the Ad label`, () => {
      expect(isPaidListing(listing)).toBe(true);
    });
  }

  it("the free hand-picked mark is not an ad", () => {
    expect(listingMark({ featured: true })).toBe("picked");
    expect(isPaidListing({ featured: true })).toBe(false);
  });

  it("an unmarked listing has no mark", () => {
    expect(listingMark({})).toBeUndefined();
    expect(isPaidListing({})).toBe(false);
  });

  it("the paid boost tier is not named like the hand-picked mark", () => {
    expect(listingMark({ boost: "Boost" })).toBe("boosted");
  });
});
