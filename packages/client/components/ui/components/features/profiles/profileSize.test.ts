import { describe, expect, it } from "vitest";

import { achievementsShown, tilesShown } from "./profileSize";

describe("profile sizes", () => {
  it("the card keeps three tiles in a row, the full profile five", () => {
    expect(tilesShown("card")).toBe(3);
    expect(tilesShown("full")).toBe(5);
  });

  it("achievements fill two rows: seven across the card, eleven across the full profile", () => {
    expect(achievementsShown("card")).toBe(2 * 7);
    expect(achievementsShown("full")).toBe(2 * 11);
  });
});
