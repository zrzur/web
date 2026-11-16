import { describe, expect, it } from "vitest";

import { viewportDeficit } from "./shortViewport";

// iPhone 16 Pro: 402 x 874 pt, status bar 62 pt
const phone = {
  screenWidth: 402,
  screenHeight: 874,
  portrait: true,
  safeTop: 62,
};

describe("short layout box of an installed app on iOS 26", () => {
  it("finds the missing height when the box is short by the status bar", () => {
    expect(viewportDeficit({ ...phone, fixedHeight: 812 })).toBe(62);
    // the measured case: 56 pt missing with a 62 pt inset
    expect(viewportDeficit({ ...phone, fixedHeight: 818 })).toBe(56);
  });

  it("is 0 when the box already fills the screen", () => {
    expect(viewportDeficit({ ...phone, fixedHeight: 874 })).toBe(0);
    expect(viewportDeficit({ ...phone, fixedHeight: 873.6 })).toBe(0);
  });

  it("is 0 when the difference is something else", () => {
    // keyboard open
    expect(viewportDeficit({ ...phone, fixedHeight: 520 })).toBe(0);
    // iPad window in split screen
    expect(
      viewportDeficit({
        screenWidth: 820,
        screenHeight: 1180,
        portrait: true,
        safeTop: 24,
        fixedHeight: 700,
      }),
    ).toBe(0);
    // no status-bar inset: a browser tab, a desktop
    expect(viewportDeficit({ ...phone, safeTop: 0, fixedHeight: 812 })).toBe(0);
    // box taller than the screen side
    expect(viewportDeficit({ ...phone, fixedHeight: 900 })).toBe(0);
    expect(viewportDeficit({ ...phone, fixedHeight: 0 })).toBe(0);
  });

  it("uses the short screen side in landscape (iOS never swaps them)", () => {
    const landscape = { ...phone, portrait: false, safeTop: 20 };
    expect(viewportDeficit({ ...landscape, fixedHeight: 382 })).toBe(20);
    expect(viewportDeficit({ ...landscape, fixedHeight: 402 })).toBe(0);
  });
});
