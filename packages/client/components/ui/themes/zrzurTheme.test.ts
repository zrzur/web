import { describe, expect, it } from "vitest";
import {
  RETIRED_DEFAULTS,
  ZRZUR_FEATHER,
  ZRZUR_FEATURES,
  ZRZUR_LIGHT,
  ZRZUR_UNIFIED_DARK,
  createZrzurSemanticVariables,
  generateZrzurColourScheme,
} from "./zrzurTheme";

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

function tokens(darkMode: boolean, accent = "#E0195F") {
  return createZrzurSemanticVariables({
    blur: true,
    interfaceFont: "Inter",
    monospaceFont: "Fira Code",
    messageSize: 16,
    messageGroupSpacing: 12,
    colourEngine: "zrzur",
    iconAccent: "",
    iconStyle: "outline",
    iconSize: 20,
    iconFill: 0.22,
    iconGlow: 0,
    radius: 10,
    railWidth: 72,
    sidebarWidth: 260,
    density: "comfortable",
    appearancePreset: "signature-dark",
    preset: "zrzur",
    darkMode,
    accent,
    contrast: 0,
    variant: "tonal_spot",
  });
}

describe("accent button text readability", () => {
  for (const accent of [
    "#FF2D78",
    "#4F5DFF",
    "#7C8FE8",
    "#FFFFFF",
    "#000000",
    "#4ADE80",
    "#FACC15",
    "#F87171",
  ]) {
    for (const dark of [true, false]) {
      it(`keeps normal text readable on ${accent} in ${dark ? "dark" : "light"} mode`, () => {
        const scheme = generateZrzurColourScheme(accent, dark);
        expect(
          contrast(scheme.primary, scheme["on-primary"]),
        ).toBeGreaterThanOrEqual(4.5);
        const z = tokens(dark, accent);
        expect(
          contrast(z["--z-accent-fill"], z["--z-on-accent"]),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("Midnight Pulse palette (brand.md section 4)", () => {
  it("defaults to Raspberry on the midnight surfaces", () => {
    const d = ZRZUR_UNIFIED_DARK;
    expect(d.accentDefault).toBe("#E0195F");
    expect(d.bgRail).toBe("#0D0E16");
    expect(d.bgSidebar).toBe("#171925");
    expect(d.bgChat).toBe("#171925");
    expect(d.bgRaised).toBe("#242638");
    expect(d.bgInput).toBe("#2A2C3C");
    expect(d.selected).toBe("#303348");
  });

  it("keeps cards and fields flat, on the ladder of surfaces", () => {
    const z = tokens(true);
    expect(z["--z-field-bg"]).toBe("var(--z-bg-input)");
    expect(z["--z-card-bg"]).toContain("var(--z-card-solid)");
    expect(z["--z-card-solid"]).toBe("var(--z-bg-sidebar)");
    expect(z["--z-tile-bg"]).toBe("var(--z-bg-input)");
  });

  it("paints the rail darkest; channel list, room and members share one ink", () => {
    const z = tokens(true);
    // frame: top bar and rail
    expect(z["--z-bg-frame"]).toBe("#0D0E16");
    // owner, 2026-11-04: the channel list colour everywhere
    expect(z["--z-bg-nav"]).toBe("var(--z-bg-sidebar)");
    expect(z["--z-bg-sidebar"]).toBe("#171925");
    // content: headers, chat, member list
    expect(z["--z-bg-shell"]).toBe("var(--z-bg-chat)");
    expect(z["--z-bg-members"]).toBe("var(--z-bg-shell)");
    expect(z["--z-bg-chat"]).toBe("#171925");
  });

  it("keeps selected rows neutral — violet is not a selected wash", () => {
    const z = tokens(true);
    expect(z["--z-nav-hover"]).toContain("white");
    expect(z["--z-message-hover"]).toContain("white");
    expect(z["--z-nav-selected"]).toBe("#303348");
    expect(z["--z-nav-selected"]).not.toContain("E0195F");
    expect(z["--z-hover"]).toBe("var(--z-nav-hover)");
  });

  it("moves the old pink and grey defaults to Midnight Pulse", () => {
    const purple = RETIRED_DEFAULTS.find(
      (r) => r.surfaces.bgChat === "#231D2C",
    );
    expect(purple!.accents).toContain("#FF2D78");
    expect(RETIRED_DEFAULTS.some((r) => r.surfaces.bgChat === "#151518")).toBe(
      true,
    );
  });

  it("fills primary buttons with Raspberry #E0195F and white text, hover #C8155A", () => {
    const z = tokens(true);
    expect(z["--z-accent"]).toBe("#E0195F");
    expect(z["--z-accent-fill"]).toBe("#E0195F");
    expect(z["--z-on-accent"]).toBe("#FFFFFF");
    expect(z["--z-accent-hover"]).toBe("#C8155A");
    expect(z["--z-accent-text"]).toBe("#FF7AA8");
    expect(z["--z-focus-ring"]).toBe("0 0 0 3px rgb(224 25 95 / 0.4)");
    expect(tokens(false)["--z-accent-text"]).toBe("#B0124F");
  });

  it("floats menus, sub-menus, tooltips and dialogs on one navy sheet", () => {
    // owner palette 2026-11-01: menus and dialogs share #1F2130 with a
    // #2E3145 border (the flat rail ink read too dark); every floating
    // surface shares it so a menu and its sub-menu always match
    expect(tokens(true)["--z-bg-popover"]).toBe("var(--z-bg-floating)");
    expect(tokens(true)["--z-bg-floating"]).toBe("#1F2130");
    expect(tokens(true)["--z-popover-border"]).toBe("#2E3145");
    expect(tokens(true)["--z-popover-bg"]).toBe(
      "var(--z-bg-popover, var(--z-bg-raised))",
    );
    // light mode floats on white
    expect(tokens(false)["--z-bg-popover"]).toBe("var(--z-bg-floating)");
    expect(tokens(false)["--z-bg-floating"]).toBe("#FFFFFF");
  });

  it("steps dialogs and menus within one navy family", () => {
    // owner palette 2026-11-01: sheet, cards, dividers, labels, icons and
    // secondary buttons are close shades of one navy; raspberry stays the
    // primary action only. Light = white sheet + mist cards.
    const dark = tokens(true);
    expect(dark["--z-dialog-bg"]).toBe("var(--z-bg-floating)");
    expect(dark["--z-dialog-card"]).toBe("#262838");
    expect(dark["--z-float-divider"]).toBe("#33364D");
    // light touches only: the Report label; no accent wash on the sheet
    expect(dark["--z-float-warning"]).toBe("#F07A9A");
    expect(contrast("#F07A9A", "#2C2F44")).toBeGreaterThanOrEqual(4.5);
    expect(dark["--z-dialog-glow"]).toBe("none");
    expect(dark["--z-field-focus-shadow"]).not.toContain("22px");
    expect(dark["--z-float-hover"]).toBe("#2C2F44");
    expect(dark["--z-float-label"]).toBe("#8A8FA8");
    expect(dark["--z-float-muted"]).toBe("#9AA0B8");
    expect(dark["--z-float-icon"]).toBe("#7C82A0");
    expect(dark["--z-float-button"]).toBe("#2C2F44");
    expect(dark["--z-float-button-hover"]).toBe("#363A52");
    // readable: labels and secondary text ≥4.5:1, icons ≥3:1
    expect(contrast("#8A8FA8", "#1F2130")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#9AA0B8", "#262838")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#7C82A0", "#262838")).toBeGreaterThanOrEqual(3);
    const light = tokens(false);
    expect(light["--z-dialog-bg"]).toBe("var(--z-bg-chat)");
    expect(light["--z-dialog-card"]).toBe("var(--z-bg-sidebar)");
  });

  it("defines the warning colour per mode (the owner label read amber on white)", () => {
    expect(tokens(true)["--z-warning"]).toBe(ZRZUR_UNIFIED_DARK.warning);
    expect(tokens(false)["--z-warning"]).toBe(ZRZUR_LIGHT.warning);
    expect(
      contrast(ZRZUR_LIGHT.warning, ZRZUR_LIGHT.bgChat),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps muted text readable on every surface it sits on", () => {
    // live audit 2026-11-01: hints and "Online" sat at 3.9-4.4:1 on cards,
    // fields and selected rows; the smallest lift that passes everywhere
    const d = ZRZUR_UNIFIED_DARK;
    const l = ZRZUR_LIGHT;
    for (const bg of [
      d.bgApp,
      d.bgSidebar,
      d.bgChat,
      d.bgRaised,
      d.bgInput,
      d.selected,
      d.bgFloating,
    ])
      expect(contrast(d.fgMuted, bg)).toBeGreaterThanOrEqual(4.5);
    for (const bg of [
      l.bgApp,
      l.bgRail,
      l.bgSidebar,
      l.bgChat,
      l.bgRaised,
      l.bgInput,
      l.slate1,
    ])
      expect(contrast(l.fgMuted, bg)).toBeGreaterThanOrEqual(4.5);
    // the hierarchy stays: muted is quieter than secondary in both modes
    expect(contrast(d.fgMuted, d.bgChat)).toBeLessThan(
      contrast(d.fgSecondary, d.bgChat),
    );
    expect(contrast(l.fgMuted, l.bgChat)).toBeLessThan(
      contrast(l.fgSecondary, l.bgChat),
    );
  });

  it("keeps the raspberry family visible on every surface in both modes", () => {
    const d = ZRZUR_UNIFIED_DARK;
    const l = ZRZUR_LIGHT;
    const dark = tokens(true);
    const light = tokens(false);
    // focus outlines need 3:1 next to every dark surface, fields and dock too
    for (const bg of [
      d.bgRail,
      d.bgSidebar,
      d.bgChat,
      d.bgRaised,
      d.bgInput,
      d.bgFloating,
    ])
      expect(contrast(dark["--z-focus"], bg)).toBeGreaterThanOrEqual(3);
    // active icons and bright accent text in light mode use the light text
    expect(light["--z-icon-active"]).toBe(l.accentText);
    expect(light["--z-accent-bright"]).toBe(l.accentText);
    for (const bg of [l.bgApp, l.bgChat, l.bgRaised, l.bgInput])
      expect(contrast(light["--z-icon-active"], bg)).toBeGreaterThanOrEqual(
        4.5,
      );
    expect(dark["--z-icon-active"]).toBe(d.accentText);
  });

  it("moves only the exact old violet default to Raspberry", () => {
    // untouched accounts saved #9075FF; other violets were picked by hand
    const accents = RETIRED_DEFAULTS.flatMap((r) => r.accents);
    expect(accents).toContain("#9075FF");
    expect(accents).not.toContain("#8A6BFF");
    expect(accents).not.toContain("#E0195F");
  });

  it("gives every colour one job", () => {
    const z = tokens(true);
    expect(z["--z-link"]).toBe("#64A9FF");
    expect(z["--z-highlight"]).toBe("#FF5BA8");
    expect(z["--z-mention-bar"]).toBe("var(--z-highlight)");
    expect(z["--z-mention-badge"]).toBe("#C2337A");
    expect(z["--z-on-mention-badge"]).toBe("#FFFFFF");
    expect(z["--z-presence-online"]).toBe("#55DCC8");
    expect(z["--z-presence-idle"]).toBe("#F3B96B");
    expect(z["--z-presence-dnd"]).toBe("#F27488");
    expect(z["--z-danger"]).toBe("#F27488");
    expect(z["--z-danger-strong"]).toBe("#D92D2D");
    expect(z["--z-presence-offline"]).toBe("#7E8299");
  });

  it("keeps white readable on mention count badges", () => {
    expect(
      contrast("#FFFFFF", ZRZUR_UNIFIED_DARK.mentionBadge),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast("#FFFFFF", ZRZUR_LIGHT.mentionBadge),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("gives Feather its gradient and Wings their gold (2026-11-01)", () => {
    const z = tokens(true);
    expect(z["--z-feather"]).toBe("linear-gradient(135deg, #D92654, #AD1A40)");
    expect(z["--z-wings"]).toBe("#FFD66B");
  });

  it("gives every area the same shapes, tied to the corner setting", () => {
    const z = tokens(true);
    expect(z["--z-shape-button"]).toBe("var(--z-radius-sm)");
    expect(z["--z-shape-chip"]).toBe("var(--z-radius-sm)");
    expect(z["--z-shape-field"]).toBe("var(--z-radius)");
    expect(z["--z-shape-card"]).toBe("calc(var(--z-radius) + 4px)");
    expect(z["--z-shape-dialog"]).toBe("calc(var(--z-radius) + 6px)");
    for (const size of ["xs", "sm", "md", "lg", "xl"])
      expect(z[`--z-control-${size}`]).toMatch(/^[0-9]+px$/);
  });

  it("keeps white words readable on both Feather stops", () => {
    for (const stop of [ZRZUR_FEATHER.solid, ZRZUR_FEATHER.end])
      expect(contrast("#FFFFFF", stop)).toBeGreaterThanOrEqual(4.5);
    expect(tokens(true)["--z-on-premium"]).toBe("#FFFFFF");
  });
  it("meets WCAG AA for text on the default surfaces", () => {
    const d = ZRZUR_UNIFIED_DARK;
    for (const bg of [d.bgChat, d.bgSidebar, d.bgRaised, d.bgFloating]) {
      for (const fg of [
        d.fgPrimary,
        d.fgSecondary,
        d.fgMuted,
        d.accentText,
        d.link,
        d.highlight,
        d.error,
        d.live,
      ]) {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(d.channelsDefault, d.bgSidebar)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast("#FFFFFF", d.accentStrong)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FFFFFF", d.accentHover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FFFFFF", d.danger)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(d.error, d.bgRaised)).toBeGreaterThanOrEqual(4.5);
    const l = ZRZUR_LIGHT;
    for (const fg of [
      l.fgPrimary,
      l.fgSecondary,
      l.fgMuted,
      l.accentText,
      l.link,
      l.mentionText,
    ]) {
      expect(contrast(fg, l.bgApp)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, l.bgChat)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses no forbidden colours", () => {
    const forbidden = /#(1D874B|00D8FF|5865F2|FF005C)\b/i;
    for (const dark of [true, false]) {
      for (const value of Object.values(tokens(dark))) {
        expect(value).not.toMatch(forbidden);
      }
      for (const value of Object.values(
        generateZrzurColourScheme("#FF2D78", dark),
      )) {
        expect(value).not.toMatch(forbidden);
      }
    }
  });

  it("moves the old slate-blue default to the new palette", () => {
    const slate = RETIRED_DEFAULTS.find((r) => r.accents.includes("#5C6B91"));
    expect(slate).toBeTruthy();
    expect(slate!.icons).toContain("#B9BDCC");
  });
});

describe("feature accents", () => {
  const FEATURES = ["discover", "wings", "voice", "invite", "safety"] as const;

  it("matches the approved table", () => {
    expect(ZRZUR_FEATURES.discover.solid).toBe("#245FC7");
    expect(ZRZUR_FEATURES.wings.solid).toBe("#FFD66B");
    expect(ZRZUR_FEATURES.voice.solid).toBe("#79E0BD");
    expect(ZRZUR_FEATURES.invite.solid).toBe("#FF5BA8");
  });

  for (const feature of FEATURES) {
    it(`${feature}: text on the fill reads at 4.5:1`, () => {
      const f = ZRZUR_FEATURES[feature];
      expect(contrast(f.on, f.solid)).toBeGreaterThanOrEqual(4.5);
    });

    for (const dark of [true, false]) {
      it(`${feature}: accent text reads on every ${dark ? "dark" : "light"} surface`, () => {
        const z = tokens(dark);
        const s = dark ? ZRZUR_UNIFIED_DARK : ZRZUR_LIGHT;
        for (const surface of [s.bgSidebar, s.bgChat, s.bgRaised])
          expect(
            contrast(z[`--z-${feature}-text`], surface),
          ).toBeGreaterThanOrEqual(4.5);
        expect(z[`--z-${feature}`]).toBe(ZRZUR_FEATURES[feature].solid);
        expect(z[`--z-on-${feature}`]).toBe(ZRZUR_FEATURES[feature].on);
      });
    }
  }
});
