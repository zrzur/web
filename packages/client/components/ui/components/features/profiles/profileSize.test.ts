import { describe, expect, it } from "vitest";

import { achievementsShown, tilesShown } from "./profileSize";

describe("profile sizes", () => {
  // the card and the full profile are one size (size.ts): the same rows
  it("three tiles in a row, in the card and the full profile", () => {
    expect(tilesShown("card")).toBe(3);
    expect(tilesShown("full")).toBe(3);
  });

  it("achievements fill two rows of seven in either view", () => {
    expect(achievementsShown("card")).toBe(2 * 7);
    expect(achievementsShown("full")).toBe(2 * 7);
  });
});
