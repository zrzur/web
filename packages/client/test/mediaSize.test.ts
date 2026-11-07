import { describe, expect, it } from "vitest";
import { fitMessageMedia } from "../components/ui/components/utils/mediaSize";
describe("message image sizing", () => {
  it.each([
    [1200, 300],
    [300, 1200],
    [400, 400],
    [40, 20],
    [100000, 1],
  ])("preserves the entire %s x %s image within the preview limit", (w, h) => {
    const size = fitMessageMedia(w, h);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    expect(size.width).toBeLessThanOrEqual(420);
    expect(size.height).toBeLessThanOrEqual(420);
    expect(size.width / size.height).toBeCloseTo(w / h, 8);
  });
  it.each([
    [0, 0],
    [-1, 200],
    [200, 0],
    [NaN, 200],
    [Infinity, 1],
  ])("reserves usable space for invalid metadata %s x %s", (w, h) => {
    expect(fitMessageMedia(w, h)).toEqual({ width: 160, height: 120 });
  });
});
