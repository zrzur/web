import { describe, expect, it } from "vitest";

import { ART_INK, ART_SKIES, ART_SKY, PALETTE, paletteTokens } from "./palette";

type RGB = [number, number, number];

function hex(value: string): RGB {
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as RGB;
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("Discover palette", () => {
  it("uses the Midnight Pulse surfaces and the pink-red action colour", () => {
    expect(PALETTE.frame).toBe("#0D0E16");
    expect(PALETTE.page).toBe("#1D1F2D");
    expect(PALETTE.raised).toBe("#242638");
    expect(PALETTE.action).toBe("#E0195F");
  });

  it("keeps text readable on every surface (AA)", () => {
    for (const surface of [
      PALETTE.frame,
      PALETTE.nav,
      PALETTE.page,
      PALETTE.raised,
      PALETTE.selected,
    ]) {
      for (const text of [
        PALETTE.title,
        PALETTE.text,
        PALETTE.textSecondary,
        PALETTE.actionText,
      ])
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
    }
    for (const surface of [
      PALETTE.frame,
      PALETTE.nav,
      PALETTE.page,
      PALETTE.raised,
    ])
      expect(contrast(PALETTE.textMuted, surface)).toBeGreaterThanOrEqual(4.5);
    // marks and links in Discover's blue, and the birds, on the dark page
    for (const surface of [PALETTE.frame, PALETTE.nav])
      expect(contrast(PALETTE.discoverText, surface)).toBeGreaterThanOrEqual(
        4.5,
      );
    expect(contrast(ART_INK, ART_SKY)).toBeGreaterThanOrEqual(7);
    for (const sky of ART_SKIES)
      expect(contrast(ART_INK, sky)).toBeGreaterThanOrEqual(4.5);
  });

  it("puts the page on the deep frame colour, cards one step up", () => {
    expect(paletteTokens["--dz-page"]).toBe("var(--z-bg-frame, #0D0E16)");
    // the box of every card comes from the shared card tokens, not from here
    expect(paletteTokens).not.toHaveProperty("--z-card-bg");
  });

  it("puts white words on the action fills at AA", () => {
    for (const fill of [
      PALETTE.action,
      PALETTE.actionHover,
      PALETTE.actionPressed,
    ])
      expect(contrast(PALETTE.onAction, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it("has no glass, and one soft glow at the top only (owner, 2026-11-04)", () => {
    const {
      "--dz-glow": glow,
      "--dz-glow-fade": fade,
      ...rest
    } = paletteTokens;
    expect(glow).toContain("radial-gradient");
    expect(fade).toContain("linear-gradient");
    const values = Object.values(rest).join(" ");
    expect(values).not.toMatch(/blur\(|gradient\(|rgb\(255 255 255/);
    expect(paletteTokens["--dz-glass-blur"]).toBe("none");
  });

  it("reads the app's tokens so a chosen theme reaches Discover", () => {
    expect(paletteTokens["--dz-chosen"]).toContain(
      "var(--z-bg-sidebar, #171925)",
    );
  });
});
