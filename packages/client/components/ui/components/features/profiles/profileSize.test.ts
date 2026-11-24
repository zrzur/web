import { describe, expect, it } from "vitest";

import { achievementsShown, narrowProfile, tilesShown } from "./profileSize";

describe("profile sizes", () => {
  it("the card keeps three tiles in a row, the full profile four", () => {
    expect(tilesShown("card")).toBe(3);
    expect(tilesShown("full")).toBe(4);
  });

  it("a full profile too narrow for four (a framed one on a phone) shows three", () => {
    expect(tilesShown("full", 428)).toBe(4);
    expect(tilesShown("full", 343)).toBe(4);
    expect(tilesShown("full", 263)).toBe(3);
    expect(tilesShown("card", 428)).toBe(3);
  });

  it("a profile drawn narrower than its usual width is narrow, the card too", () => {
    expect(narrowProfile("full", 428)).toBe(false);
    expect(narrowProfile("full", 343)).toBe(false);
    expect(narrowProfile("full", 263)).toBe(true);
    // the card: 328 px on a desktop and in a phone's bottom sheet (343),
    // 263 px when framed on a 375 px phone
    expect(narrowProfile("card", 328)).toBe(false);
    expect(narrowProfile("card", 343)).toBe(false);
    expect(narrowProfile("card", 263)).toBe(true);
    expect(narrowProfile("card")).toBe(false);
  });

  it("achievements fill two rows: seven across the card, ten across the full profile", () => {
    expect(achievementsShown("card")).toBe(2 * 7);
    expect(achievementsShown("full")).toBe(2 * 10);
  });
});
