import { describe, expect, it } from "vitest";

import {
  EFFECT_DURATION_MS,
  EFFECT_IDS,
  EFFECT_MAX_ALPHA,
  EFFECT_MAX_COVER,
  EffectId,
  effectFrame,
  effectTones,
} from "./effects";
import {
  FLASH_AREA_PX,
  Sample,
  failingArea,
  flashesPerSecond,
  sampleOf,
} from "./flash";
import { shapeBody } from "./shapes";

const channels = (hex: string) =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);

const CARD = { width: 360, height: 640 };
const CELL = 4;
const FPS = 30;

/** Draw one frame into a grid of samples, in plain code */
function rasterise(id: EffectId, ms: number, backdrop: number): Sample[][] {
  const columns = Math.ceil(CARD.width / CELL);
  const rows = Math.ceil(CARD.height / CELL);
  const pixels = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => [backdrop, backdrop, backdrop]),
  );

  const tones = effectTones(id);
  for (const particle of effectFrame(id, ms)) {
    const [bodyWidth, bodyHeight] = shapeBody(particle.shape);
    const radius = particle.size * CARD.width;
    const across = Math.max(CELL / 2, radius * bodyWidth * particle.squash);
    const tall = Math.max(CELL / 2, radius * bodyHeight);
    const px = particle.x * CARD.width;
    const py = particle.y * CARD.height;
    const reach = Math.ceil(Math.max(across, tall) / CELL) + 1;
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    const cos = Math.cos(particle.angle);
    const sin = Math.sin(particle.angle);
    const colour = channels(tones[particle.colour][0]);
    for (let y = cy - reach; y <= cy + reach; y++) {
      for (let x = cx - reach; x <= cx + reach; x++) {
        if (y < 0 || x < 0 || y >= rows || x >= columns) continue;
        const dx = x * CELL + CELL / 2 - px;
        const dy = y * CELL + CELL / 2 - py;
        // in the particle's own turned frame
        const u = (dx * cos + dy * sin) / across;
        const v = (dy * cos - dx * sin) / tall;
        const distance = Math.hypot(u, v);
        const hit =
          particle.shape === "ripple" || particle.shape === "bubble"
            ? Math.abs(distance - 1) < 0.2 + CELL / tall
            : distance <= 1;
        if (!hit) continue;
        pixels[y][x] = pixels[y][x].map(
          (value, i) =>
            value * (1 - particle.alpha) + colour[i] * particle.alpha,
        );
      }
    }
  }

  return pixels.map((row) => row.map(([r, g, b]) => sampleOf(r, g, b)));
}

describe("flash check", () => {
  const dark = sampleOf(0, 0, 0);
  const light = sampleOf(1, 1, 1);

  it("counts a strobe", () => {
    const strobe = Array.from({ length: 30 }, (_, i) => (i % 2 ? light : dark));
    expect(flashesPerSecond(strobe, 30)).toBeGreaterThan(3);
  });

  it("lets three flashes a second through", () => {
    const samples: Sample[] = [];
    for (let flash = 0; flash < 3; flash++) {
      samples.push(...Array(5).fill(dark), ...Array(5).fill(light));
    }
    expect(flashesPerSecond(samples, 30)).toBeLessThanOrEqual(3);
  });

  it("does not count a slow fade", () => {
    const fade = Array.from({ length: 60 }, (_, i) =>
      sampleOf(i / 60, i / 60, i / 60),
    );
    expect(flashesPerSecond(fade, 30)).toBe(0);
  });

  it("counts a red strobe", () => {
    const red = sampleOf(1, 0, 0);
    const off = sampleOf(0.1, 0, 0);
    const strobe = Array.from({ length: 30 }, (_, i) => (i % 2 ? red : off));
    expect(flashesPerSecond(strobe, 30)).toBeGreaterThan(3);
  });
});

describe.each(EFFECT_IDS)("effect %s", (id) => {
  it("is over within the limit and draws nothing afterwards", () => {
    expect(EFFECT_DURATION_MS).toBeLessThanOrEqual(4000);
    expect(effectFrame(id, EFFECT_DURATION_MS)).toEqual([]);
    expect(effectFrame(id, -1)).toEqual([]);
    expect(effectFrame(id, EFFECT_DURATION_MS / 2).length).toBeGreaterThan(0);
  });

  it("keeps wide light faint", () => {
    for (const particle of effectFrame(id, 2000)) {
      if (particle.shape === "curtain" || particle.shape === "ray") {
        expect(particle.alpha).toBeLessThan(0.45);
      }
    }
  });

  it("never gets fully solid", () => {
    for (let ms = 0; ms < EFFECT_DURATION_MS; ms += 200) {
      for (const particle of effectFrame(id, ms)) {
        expect(particle.alpha).toBeLessThanOrEqual(EFFECT_MAX_ALPHA);
      }
    }
  });

  it("leaves most of the card clear in every frame", () => {
    const light = ["ripple", "bubble", "rosette", "wave", "curtain", "ray"];
    for (let ms = 0; ms < EFFECT_DURATION_MS; ms += 200) {
      let covered = 0;
      for (const particle of effectFrame(id, ms)) {
        // lines and light are thin or see-through, never a solid patch
        if (light.includes(particle.shape)) continue;
        const [across, tall] = shapeBody(particle.shape);
        const radius = particle.size * CARD.width;
        covered +=
          Math.PI *
          radius *
          across *
          particle.squash *
          radius *
          tall *
          particle.alpha;
      }
      expect(covered / (CARD.width * CARD.height)).toBeLessThan(
        EFFECT_MAX_COVER,
      );
    }
  });

  it.each([
    ["black", 0],
    ["white", 1],
  ])("does not flash over %s", (_name, backdrop) => {
    const frames: Sample[][][] = [];
    for (let ms = 0; ms < EFFECT_DURATION_MS; ms += 1000 / FPS) {
      frames.push(rasterise(id, ms, backdrop));
    }
    expect(failingArea(frames, FPS, CELL * CELL)).toBeLessThan(FLASH_AREA_PX);
  });
});
