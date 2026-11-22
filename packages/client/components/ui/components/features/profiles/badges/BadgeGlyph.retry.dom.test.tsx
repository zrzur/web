import { describe, expect, it } from "vitest";

import { loadBadgeArt } from "./BadgeGlyph";

describe("badge art after a lost download", () => {
  it("is asked for again after a failure, and then arrives", async () => {
    let tries = 0;
    const lost = () => {
      tries++;
      return Promise.reject(
        new TypeError("Failed to fetch dynamically imported module"),
      );
    };
    const arrives = () => {
      tries++;
      return Promise.resolve({ BADGE_ART: { founder: "<path/>" } });
    };

    await expect(loadBadgeArt(lost)).rejects.toThrow("Failed to fetch");
    // the next badge drawn asks again (it kept the failure until a reload)
    await expect(loadBadgeArt(arrives)).resolves.toBeUndefined();
    expect(tries).toBe(2);
    // and once it is here it is not asked for again
    await loadBadgeArt(lost);
    expect(tries).toBe(2);
  });
});
