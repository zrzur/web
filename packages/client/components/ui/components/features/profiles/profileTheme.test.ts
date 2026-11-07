import { describe, expect, it } from "vitest";

import {
  contrast,
  mixColours,
  readableName,
  readableTheme,
  seededTheme,
  toneForSurface,
} from "./profileTheme";
import { THEME_PRESETS } from "./userStyle";

const parts = (hsl: string) => hsl.match(/[\d.]+/g)!.map(Number);

const hex = (n: number) => n.toString(16).padStart(2, "0");

describe("readable themes", () => {
  const levels = [0, 51, 119, 136, 187, 255];
  const colours = levels.flatMap((r) =>
    levels.flatMap((g) => levels.map((b) => `#${hex(r)}${hex(g)}${hex(b)}`)),
  );
  // every colour with itself, with black and white, and the presets
  const pairs: [string, string][] = [
    ...colours.map((c): [string, string] => [c, c]),
    ...colours.map((c): [string, string] => [c, "#ffffff"]),
    ...colours.map((c): [string, string] => ["#000000", c]),
    ["#ffffff", "#000000"],
    ["#ff0000", "#00ff00"],
    ["#00ff00", "#ff00ff"],
    ...THEME_PRESETS.map((p) => p.colours),
  ];

  it("checks more than a handful of themes", () => {
    expect(pairs.length).toBeGreaterThan(600);
  });

  it("reads at AA everywhere on the gradient, for every kind of text", () => {
    for (const [top, bottom] of pairs) {
      const theme = readableTheme({ top, bottom });
      for (let t = 0; t <= 1; t += 0.125) {
        const surface = mixColours(theme.top, theme.bottom, t);
        const chip = mixColours(surface, theme.away, theme.chipAmount);
        for (const [text, amount, on] of [
          [theme.ink, 1, surface],
          [theme.ink, theme.secondaryAmount, surface],
          [theme.ink, theme.mutedAmount, surface],
          [theme.ink, 1, chip],
          [theme.ink, theme.mutedAmount, chip],
        ] as const) {
          const colour = mixColours(on, text, amount);
          expect(
            contrast(colour, on),
            `${top} ${bottom} at ${t}, amount ${amount}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("keeps light text and deepens a pale theme until it reads", () => {
    const pale = readableTheme({ top: "#ffffff", bottom: "#fecfef" });
    expect(pale.ink).toBe("#ffffff");
    expect(contrast(pale.top, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("deepens every theme by the same base amount", () => {
    const theme = readableTheme({ top: "#000000", bottom: "#000000" });
    expect(theme.top).toBe(mixColours("#000000", "#11121c", 0.22));
  });

  it("keeps a chosen name colour only where it reads", () => {
    const theme = readableTheme({ top: "#000000", bottom: "#000000" });
    expect(readableName(["#ffffff"], theme)).toBe(true);
    expect(readableName(["#000000"], theme)).toBe(false);
    expect(readableName(["#ffffff", "#111111"], theme)).toBe(false);
  });
});

describe("profile colours", () => {
  it("keeps picked colours dark enough for white text", () => {
    for (const rgb of [
      [255, 255, 255],
      [250, 220, 40],
      [0, 0, 0],
      [30, 120, 255],
    ]) {
      const [, saturation, lightness] = parts(toneForSurface(rgb));
      expect(lightness).toBeGreaterThanOrEqual(22);
      expect(lightness).toBeLessThanOrEqual(42);
      expect(saturation).toBeGreaterThanOrEqual(25);
      expect(saturation).toBeLessThanOrEqual(75);
    }
  });

  it("keeps the hue of the source colour", () => {
    expect(parts(toneForSurface([220, 40, 40]))[0]).toBe(0);
    expect(parts(toneForSurface([40, 200, 40]))[0]).toBe(120);
  });

  it("gives each user the same colours every time", () => {
    expect(seededTheme("01ABC")).toEqual(seededTheme("01ABC"));
    expect(seededTheme("01ABC")).not.toEqual(seededTheme("01XYZ"));
    expect(seededTheme(undefined)).toBeUndefined();
  });
});
