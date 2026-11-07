import { describe, expect, it } from "vitest";

import {
  APPEARANCE_PRESETS,
  LISTED_THEME_PRESETS,
  getAppearancePreset,
} from "./appearancePresets";
import {
  THEME_COLLECTIONS,
  THEME_LIBRARY,
  activeLibraryTheme,
  themeAccessibilityCss,
  themeLibraryVariables,
} from "./themeLibrary";

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((value) => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("theme library", () => {
  it("keeps the optional library for contrast, and four Appearance packs", () => {
    expect(THEME_LIBRARY).toHaveLength(20);
    expect(THEME_COLLECTIONS).toEqual(["luxury", "midnight", "warm", "light"]);
    for (const collection of THEME_COLLECTIONS) {
      expect(
        THEME_LIBRARY.filter((t) => t.collection === collection).length,
      ).toBeGreaterThanOrEqual(3);
    }
    expect(APPEARANCE_PRESETS.map((p) => p.id)).toEqual([
      "signature-dark",
      "graphite",
      "amoled",
      "daylight",
    ]);
    // every pack shares the Raspberry default so roles stay one family
    for (const pack of APPEARANCE_PRESETS) {
      expect(pack.accent).toBe("#E0195F");
    }
  });

  for (const theme of THEME_LIBRARY) {
    it(`${theme.name} meets WCAG AA`, () => {
      const surfaces = [theme.nav, theme.chat, theme.raised];
      for (const bg of surfaces) {
        for (const fg of [
          theme.fg,
          theme.fg2,
          theme.muted,
          theme.accentText,
          theme.link,
          theme.highlight,
          theme.error,
        ]) {
          expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
        }
      }
      const onFill = theme.onFill ?? "#FFFFFF";
      for (const fill of [theme.fill, theme.fillHover]) {
        expect(contrast(onFill, fill)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast("#FFFFFF", theme.danger)).toBeGreaterThanOrEqual(4.5);
      // the Bot and Official tags: --z-fg-primary on --z-slate-1
      expect(contrast(theme.fg, theme.selected)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("only applies a theme in the mode it was made for", () => {
    expect(
      activeLibraryTheme({ appearancePreset: "nebula", darkMode: true })?.id,
    ).toBe("nebula");
    expect(
      activeLibraryTheme({ appearancePreset: "nebula", darkMode: false }),
    ).toBeUndefined();
    expect(
      activeLibraryTheme({ appearancePreset: "arctic-light", darkMode: false })
        ?.id,
    ).toBe("arctic-light");
  });

  it("leaves the default theme's tokens alone", () => {
    expect(
      themeLibraryVariables({
        appearancePreset: "signature-dark",
        darkMode: true,
      }),
    ).toEqual({});
  });

  it("lists the themes that were plugins on the Appearance page", () => {
    expect(LISTED_THEME_PRESETS.map((p) => p.id)).toEqual([
      "high-contrast",
      "paper",
      "desert-dawn",
    ]);
    for (const preset of LISTED_THEME_PRESETS) {
      expect(getAppearancePreset(preset.id)).toBe(preset);
      expect(preset.name).not.toBe("");
      expect(preset.description).not.toBe("");
      // picking it puts the app in the mode the theme was made for
      expect(
        activeLibraryTheme({
          appearancePreset: preset.id,
          darkMode: preset.mode === "dark",
        })?.id,
      ).toBe(preset.id);
    }
  });

  it("gives a bright fill its dark text", () => {
    const vars = themeLibraryVariables({
      appearancePreset: "high-contrast",
      darkMode: true,
    });
    expect(vars["--z-accent-fill"]).toBe("#4CC2FF");
    expect(vars["--z-on-accent"]).toBe("#000000");
  });

  it("carries High Contrast's reading aids, and only for that theme", () => {
    const css = themeAccessibilityCss({
      appearancePreset: "high-contrast",
      darkMode: true,
    });
    expect(css).toContain("html{font-size:110.0% !important;}");
    expect(css).toContain("a{text-decoration:underline !important;}");
    expect(css).toContain(":focus-visible{outline:3px solid var(--z-focus)");
    expect(css).toContain("animation-duration:0.01ms");
    for (const appearancePreset of ["paper", "signature-dark"]) {
      expect(themeAccessibilityCss({ appearancePreset, darkMode: true })).toBe(
        "",
      );
    }
  });

  it("gives each theme a full token set", () => {
    const vars = themeLibraryVariables({
      appearancePreset: "royal-navy",
      darkMode: true,
    });
    expect(Object.keys(vars).length).toBeGreaterThanOrEqual(40);
    expect(vars["--z-bg-chat"]).toBe("#111A33");
    expect(vars["--z-accent-fill"]).toBe("#3E71CC");
  });
});
