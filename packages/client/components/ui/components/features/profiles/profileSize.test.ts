import { describe, expect, it } from "vitest";

import { achievementsShown, tilesShown } from "./profileSize";

describe("profile sizes", () => {
  it("the card keeps three tiles in a row, the full profile four", () => {
    expect(tilesShown("card")).toBe(3);
    expect(tilesShown("full")).toBe(4);
  });

  it("achievements fill two rows: seven across the card, ten across the full profile", () => {
    expect(achievementsShown("card")).toBe(2 * 7);
    expect(achievementsShown("full")).toBe(2 * 10);
  });
});
