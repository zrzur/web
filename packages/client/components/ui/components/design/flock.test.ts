import { describe, expect, it } from "vitest";

import {
  SKY_HEIGHT,
  SKY_WIDTH,
  skyFlock,
  skyLayers,
  skyPath,
  skyScattered,
} from "./flock";

describe("the home flock", () => {
  it("is the same on every visit", () => {
    expect(skyFlock(40)).toEqual(skyFlock(40));
  });

  it("stays inside the sky", () => {
    for (const bird of [...skyFlock(240), ...skyScattered(240)]) {
      expect(bird.x).toBeGreaterThanOrEqual(0);
      expect(bird.x).toBeLessThanOrEqual(SKY_WIDTH);
      expect(bird.y).toBeGreaterThanOrEqual(0);
      expect(bird.y).toBeLessThanOrEqual(SKY_HEIGHT);
    }
  });

  it("gives every bird a start of its own", () => {
    expect(skyScattered(240)).toHaveLength(skyFlock(240).length);
  });

  it("uses the width of the sky, so wide screens are not half empty", () => {
    const xs = skyFlock(240).map((bird) => bird.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(SKY_WIDTH * 0.8);
  });
});

describe("the flock at rest", () => {
  it("draws every bird in a handful of paths", () => {
    const birds = skyFlock(200);
    const layers = skyLayers(birds);
    expect(layers.length).toBeLessThanOrEqual(6);
    const drawn = layers.map((layer) => layer.d).join("");
    expect(drawn.match(/M/g)).toHaveLength(200);
  });

  it("draws nothing for no birds", () => {
    expect(skyPath([])).toBe("");
  });
});
