import type { SelectedTheme } from "@revolt/state/stores/Theme";

/**
 * Zrzur default palette "Midnight Pulse" (brand.md section 4, owner
 * decision 2026-10-28).
 *
 * Rich ink-navy surfaces in three steps (rail, channel list, chat), cards
 * and hover one and two steps up. Every colour has one job: Raspberry
 * = actions, focus and
 * selection; Neon Pink = mentions, invites and
 * highlights; blue = links and info; aqua = online and success; amber =
 * warnings; coral = errors and deleting.
 * Contrast on the old chat #1D1F2D (now #171925, higher): text 14.5, secondary 6.7, muted 5.2,
 * raspberry text 6.6, pink 5.7, blue 6.7, aqua 9.7, coral 5.9 : 1. White on
 * #E0195F reads at 4.7:1, so filled buttons use it directly; hover #C8155A,
 * pressed #B0124F.
 */
export const ZRZUR_UNIFIED_DARK = {
  // surfaces: rail/top bar, channel list, chat (member list = chat)
  bgApp: "#0D0E16",
  bgRail: "#0D0E16",
  bgSidebar: "#171925",
  bgChat: "#171925",
  // cards, selected messages, buttons above the chat
  bgRaised: "#242638",
  // fields / wells: one soft step above raised
  bgInput: "#2A2C3C",
  // menus, dialogs, pop-ups and tooltips: one navy sheet with its own family
  // of steps (owner palette 2026-11-01, replaces the flat rail ink)
  bgFloating: "#1F2130",
  floatBorder: "#2E3145",
  // cards inside a dialog (server card, About, Details)
  floatCard: "#262838",
  // card edges, row dividers, menu separators
  floatDivider: "#33364D",
  // menu row hover
  floatHover: "#2C2F44",
  // section titles (ABOUT / SERVER DETAILS): 4.8:1 on the sheet
  floatLabel: "#8A8FA8",
  // secondary text (owner, dates, ids): 5.5:1 on the cards
  floatMuted: "#9AA0B8",
  // row icons: 3.8:1 on the cards
  floatIcon: "#7C82A0",
  // server icon fallback tile
  floatTile: "#2F3248",
  // secondary buttons in a dialog
  floatButton: "#2C2F44",
  floatButtonHover: "#363A52",
  floatButtonBorder: "#383C55",
  // warning actions (Report): 5.1:1 on the secondary button
  floatWarning: "#F07A9A",
  // solid raised used for cards; live row hover is a soft white wash (see --z-nav-hover)
  hover: "#242638",
  selected: "#303348",
  headerPrimary: "#F7F8FC",
  fgPrimary: "#F0F1F8",
  fgSecondary: "#A1A5B8",
  // lifted 2026-11-01 so hints stay ≥4.5:1 on cards, fields and selected rows
  fgMuted: "#979BB1",
  channelsDefault: "#979BB1",
  // Raspberry: actions, focus, selection (not every chrome icon)
  accentDefault: "#E0195F",
  // filled primary buttons (white text 4.7:1) and their hover / pressed
  accentStrong: "#E0195F",
  accentHover: "#C8155A",
  accentPressed: "#B0124F",
  // raspberry used as text on dark surfaces (lifted for contrast)
  accentText: "#FF7AA8",
  // focus outlines: one shade lighter so they reach 3:1 next to fields and
  // the message dock too (#E0195F is 2.9:1 on #2A2C3C)
  accentFocus: "#EC3D78",
  // links and info
  link: "#64A9FF",
  // selected rows: calm ink (not an accent wash)
  accentSoft: "#303348",
  // outline chrome icons stay muted; selected rows use accentText
  iconDefault: "#A1A5B8",
  // Neon Pink: mentions, invites, highlights
  highlight: "#FF5BA8",
  highlightLight: "#FFADD4",
  mentionBg: "rgb(255 91 168 / 0.10)",
  mentionPill: "rgb(255 91 168 / 0.28)",
  mentionText: "#FFADD4",
  // filled mention count badges: darker pink so white text stays ≥4.5:1
  // (white on raw #FF5BA8 is ~2.9:1 — forbidden by brand.md §4)
  mentionBadge: "#C2337A",
  onMentionBadge: "#FFFFFF",
  /*
   * The ink ladder above the cards (secondary buttons rest/hover/pressed,
   * strong borders, supporting greys)
   */
  slate1: "#303348",
  slate2: "#3B3F58",
  slate3: "#4A4E6A",
  support: "#5E6280",
  slate5: "#7E8299",
  borderSoft: "#303348",
  // lighter steps of the raspberry (soft #FAD7E4 from the identity pack)
  accentBright: "#FF7AA8",
  accentLight: "#FAD7E4",
  // aqua only means online / success / "happening now"
  live: "#55DCC8",
  avatar: "#E0195F",
  // error as text and icons (coral, 5.4:1 on cards)
  error: "#F27488",
  onError: "#1A0A0E",
  errorContainer: "#3A1D2A",
  onErrorContainer: "#FFD9DF",
  // destructive filled buttons, white text (4.5:1)
  danger: "#B85867",
  dangerHover: "#A04D5A",
  success: "#55DCC8",
  warning: "#F3B96B",
  idle: "#F3B96B",
  dnd: "#F27488",
  offline: "#7E8299",
} as const;

/**
 * Light companion: same roles, pale ink-tinted surfaces. Raspberry fills use
 * #E0195F (white text 4.7:1), raspberry text #B0124F, links #3F6BA4, pink
 * #B03C73 (all 4.5:1 or more on the light surfaces).
 */
export const ZRZUR_LIGHT = {
  bgApp: "#F1F2F8",
  bgRail: "#E4E6F0",
  bgSidebar: "#F3F4FA",
  bgChat: "#FFFFFF",
  // one step above white so cards / fields read on the chat
  bgRaised: "#EEF0F7",
  bgInput: "#E8EAF3",
  bgDock: "#EFF0F7",
  fgPrimary: "#171925",
  fgSecondary: "#454A62",
  // ≥4.5:1 on every light surface, the rail and sidebar too (2026-11-01)
  fgMuted: "#5E6379",
  slate1: "#E7E8F2",
  slate2: "#DADCEA",
  slate3: "#C5C8DB",
  support: "#8A8EA5",
  slate5: "#6C7088",
  accentFill: "#C8155A",
  accentHover: "#B0124F",
  accentPressed: "#9C0F46",
  accentText: "#B0124F",
  link: "#3F6BA4",
  mentionBg: "rgb(255 91 168 / 0.08)",
  mentionPill: "rgb(255 91 168 / 0.16)",
  mentionText: "#B03C73",
  // filled mention count badges on light surfaces (white ≥4.5:1)
  mentionBadge: "#B03C73",
  onMentionBadge: "#FFFFFF",
  live: "#1C8577",
  danger: "#B4233B",
  success: "#1C8577",
  warning: "#926400",
} as const;

/**
 * Paid features. Feather (the member subscription) and paid promotion wear
 * the pink-red of the Designs and Discover search button; Wings (server boosts) wear lavender.
 * White text reads on every stop of the gradient (4.8:1 or more).
 */
export const ZRZUR_FEATHER = {
  solid: "#D92654",
  text: "#FF7A9C",
  light: "#FFB3C6",
  deep: "#2A0E17",
  end: "#AD1A40",
  gradient: "linear-gradient(135deg, #D92654, #AD1A40)",
  hero: "linear-gradient(160deg, #171925 0%, #3A0F1F 45%, #A81F45 80%, #D92654 100%)",
} as const;

/**
 * Wings (server boosts) and levels: gold, the reward colour of the app icon
 * set.
 */
export const ZRZUR_WINGS = {
  solid: "#FFD66B",
  text: "#FFD66B",
  light: "#FFF0C2",
  deep: "#241C08",
  // dark ink (deep) reads on every stop
  gradient: "linear-gradient(135deg, #FFE7A3, #FFD66B 55%, #F5C24F)",
  hero: "linear-gradient(160deg, #171925 0%, #3A3220 50%, #8A6A1E 100%)",
} as const;

/**
 * Feature accents. Each one
 * marks its own area only: section headers, highlights, progress, selected
 * tabs. Buttons, type, spacing and layout stay shared.
 * `on` is the text on the fill; `textDark` / `textLight` read at 4.5:1 or
 * more on the dark and light surfaces.
 */
export const ZRZUR_FEATURES = {
  discover: {
    solid: "#245FC7",
    on: "#FFFFFF",
    textDark: "#8DB4FF",
    textLight: "#1D4FB0",
  },
  wings: {
    solid: ZRZUR_WINGS.solid,
    on: "#191B27",
    textDark: ZRZUR_WINGS.text,
    textLight: "#8A5A00",
  },
  voice: {
    solid: "#79E0BD",
    on: "#191B27",
    textDark: "#79E0BD",
    textLight: "#0B7A5C",
  },
  invite: {
    solid: "#FF5BA8",
    on: "#191B27",
    textDark: "#FF5BA8",
    textLight: "#B03C73",
  },
  // serious and restrained: neutral slate; danger stays for destructive actions
  safety: {
    solid: "#3A3F55",
    on: "#FFFFFF",
    textDark: "#B4B9CC",
    textLight: "#4A5068",
  },
} as const;

type RetiredDefault = {
  accents: readonly string[];
  /** icon accents that went with this default */
  icons?: readonly string[];
  surfaces: {
    bgApp: string;
    bgRail: string;
    bgSidebar: string;
    bgChat: string;
    bgRaised: string;
  };
};

/**
 * Earlier defaults (the Discord-like "Signature Dark", a near-black
 * "Starling night", the slate-blue set, ...). Stored themes still carrying
 * one of these exact sets are moved to the current palette; customised
 * themes are kept.
 */
export const RETIRED_DEFAULTS: readonly RetiredDefault[] = [
  {
    // the short-lived neutral grey set (2026-10-28)
    accents: [],
    surfaces: {
      bgApp: "#0E0E10",
      bgRail: "#0E0E10",
      bgSidebar: "#0E0E10",
      bgChat: "#151518",
      bgRaised: "#1F1F23",
    },
  },
  {
    // the purple-tinted Zrzur Pink set (pink accent and its surfaces)
    accents: ["#FF2D78"],
    icons: ["#FF2D78"],
    surfaces: {
      bgApp: "#15111C",
      bgRail: "#15111C",
      bgSidebar: "#1C1724",
      bgChat: "#231D2C",
      bgRaised: "#2A2334",
    },
  },
  {
    accents: ["#7C8FE8"],
    surfaces: {
      bgApp: "#101217",
      bgRail: "#151820",
      bgSidebar: "#1B1F28",
      bgChat: "#20242E",
      bgRaised: "#292E39",
    },
  },
  {
    accents: ["#4F5DFF", "#5D6CFF"],
    surfaces: {
      bgApp: "#070B16",
      bgRail: "#090E1B",
      bgSidebar: "#0C1222",
      bgChat: "#0E1528",
      bgRaised: "#18213D",
    },
  },
  {
    // soft indigo, Starling rose, then Zrzur slate-blue on the slate set
    // (#5064BA was the Daylight preset's indigo)
    accents: ["#5568CF", "#C8457F", "#5C6B91", "#5064BA", "#1D874B"],
    icons: ["#B9BDCC", "#8E99FF"],
    surfaces: {
      bgApp: "#0C0F19",
      bgRail: "#10131F",
      bgSidebar: "#151926",
      bgChat: "#1A1D2B",
      bgRaised: "#262A3B",
    },
  },
  {
    // a short-lived neutral grey set (its icon grey included)
    accents: ["#B6B7BE"],
    surfaces: {
      bgApp: "#111214",
      bgRail: "#141517",
      bgSidebar: "#18191C",
      bgChat: "#1D1E22",
      bgRaised: "#2A2B30",
    },
  },
  {
    // Electric Violet, the default until 2026-11-01. Only the exact default
    // value moves to Raspberry; other violets were picked by hand and stay.
    accents: ["#9075FF"],
    surfaces: {
      bgApp: "#0D0E16",
      bgRail: "#0D0E16",
      bgSidebar: "#171925",
      bgChat: "#1D1F2D",
      bgRaised: "#242638",
    },
  },
  {
    // a short-lived violet palette from the brand sheet
    accents: ["#7C3AED", "#8B5CF6"],
    surfaces: {
      bgApp: "#0D0B1A",
      bgRail: "#110E21",
      bgSidebar: "#161329",
      bgChat: "#1B1731",
      bgRaised: "#2A2545",
    },
  },
];

/** Desktop panel targets from Signature Dark reference */
export const ZRZUR_LAYOUT = {
  railWidth: 72,
  sidebarWidth: 260,
  memberWidth: 260,
  headerHeight: 56,
  accountBarHeight: 60,
  composerMinHeight: 56,
} as const;

export const ZRZUR_SPACING = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export type ZrzurIconStyle = "outline" | "filled" | "expressive";

/**
 * Relative luminance helpers for contrast-aware on-accent text.
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOn(accent: string): string {
  const ink = ZRZUR_UNIFIED_DARK.bgApp;
  const paper = "#FFFFFF";
  const value = luminance(accent);
  const lightContrast = (luminance(paper) + 0.05) / (value + 0.05);
  // white on saturated accents (the brand indigo) whenever it is legible as
  // normal text (WCAG AA); dark ink only on pale accents
  if (lightContrast >= 4.5) return paper;
  const darkContrast = (value + 0.05) / (luminance(ink) + 0.05);
  return darkContrast >= lightContrast ? ink : paper;
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Hover shade of a filled accent: a step lighter in dark mode (darker in
 * light mode), backing off so the text on it keeps 4.5:1. When even a
 * small lift would cost legibility, hover darkens instead.
 */
function hoverOf(accent: string, dark: boolean): string {
  const on = contrastOn(accent);
  if (dark) {
    for (const amount of [0.1, 0.07, 0.04]) {
      const shade = mix(accent, "#FFFFFF", amount);
      if (ratio(shade, on) >= 4.5) return shade;
    }
    if (on === "#FFFFFF") return mix(accent, "#000000", 0.08);
  }
  return mix(accent, "#000000", 0.1);
}

function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  const m = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * Math.min(1, Math.max(0, amount)));
  return `#${[m(0), m(1), m(2)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

export type ZrzurSurfaces = {
  bgApp?: string;
  bgRail?: string;
  bgSidebar?: string;
  bgChat?: string;
  bgRaised?: string;
};

const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** true while the accent is the default Zrzur Pink */
export function isDefaultAccent(accent?: string): boolean {
  return !accent || same(accent, ZRZUR_UNIFIED_DARK.accentDefault);
}

/**
 * true while the dark surfaces are the default Zrzur Pink set (no
 * preset or custom surfaces); only then do the brand's own shell shades,
 * hovers and floating surface apply, so other presets keep their look
 */
function isDefaultSurfaces(surfaces?: ZrzurSurfaces): boolean {
  const d = ZRZUR_UNIFIED_DARK;
  return (
    !surfaces ||
    (["bgApp", "bgSidebar", "bgChat", "bgRaised"] as const).every(
      (key) => !surfaces[key] || same(surfaces[key], d[key]),
    )
  );
}

/**
 * The filled form of an accent (buttons, badges, pills with text). The
 * default raspberry fills with #E0195F itself (white text 4.7:1);
 * custom accents fill with themselves.
 */
function fillOf(accent: string): string {
  return isDefaultAccent(accent) ? ZRZUR_UNIFIED_DARK.accentStrong : accent;
}

/**
 * Material-compatible colour map using Unified Dark surfaces.
 * Keeps `--md-sys-color-*` consumers working while leaving Material You.
 */
export function generateZrzurColourScheme(
  accent: string,
  darkMode: boolean,
  surfaces?: ZrzurSurfaces,
  /** light library themes: their own light surfaces and text */
  light?: {
    bgApp: string;
    bgRail: string;
    bgSidebar: string;
    bgChat: string;
    bgRaised: string;
    fgPrimary: string;
    fgSecondary: string;
    fgMuted: string;
  },
): Record<string, string> {
  const d = ZRZUR_UNIFIED_DARK;
  const chosen = accent || d.accentDefault;

  if (!darkMode) {
    // Soft light companion — same family, not Material You pastel.
    const l = ZRZUR_LIGHT;
    // in light mode the default pink is used in its deeper shade, which
    // reads both as text on white and under white text (4.7:1)
    const primary = isDefaultAccent(chosen) ? d.accentStrong : chosen;
    const onPrimary = contrastOn(primary);
    const bg = light?.bgApp ?? l.bgApp;
    const rail = light?.bgRail ?? l.bgRail;
    const sidebar = light?.bgSidebar ?? l.bgSidebar;
    const chat = light?.bgChat ?? l.bgChat;
    const raised = light?.bgRaised ?? l.bgRaised;
    const fg = light?.fgPrimary ?? l.fgPrimary;
    const fgVar = light?.fgSecondary ?? l.fgSecondary;
    const muted = light?.fgMuted ?? l.fgMuted;
    return {
      primary,
      "on-primary": onPrimary,
      "primary-container": mix(primary, "#FFFFFF", 0.82),
      "on-primary-container": mix(primary, "#000000", 0.55),
      secondary: mix(primary, muted, 0.35),
      "on-secondary": onPrimary,
      "secondary-container": mix(primary, "#FFFFFF", 0.88),
      "on-secondary-container": fg,
      tertiary: l.success,
      "on-tertiary": "#FFFFFF",
      "tertiary-container": mix(d.success, "#FFFFFF", 0.8),
      "on-tertiary-container": mix(d.success, "#000000", 0.5),
      error: l.danger,
      "on-error": "#FFFFFF",
      "error-container": mix(l.danger, "#FFFFFF", 0.85),
      "on-error-container": mix(l.danger, "#000000", 0.45),
      "primary-fixed": mix(primary, "#FFFFFF", 0.7),
      "primary-fixed-dim": mix(primary, "#FFFFFF", 0.55),
      "on-primary-fixed": fg,
      "on-primary-fixed-variant": fgVar,
      "secondary-fixed": mix(primary, "#FFFFFF", 0.8),
      "secondary-fixed-dim": mix(primary, "#FFFFFF", 0.65),
      "on-secondary-fixed": fg,
      "on-secondary-fixed-variant": fgVar,
      "tertiary-fixed": mix(d.success, "#FFFFFF", 0.8),
      "tertiary-fixed-dim": mix(d.success, "#FFFFFF", 0.65),
      "on-tertiary-fixed": fg,
      "on-tertiary-fixed-variant": fgVar,
      "surface-dim": rail,
      surface: bg,
      "surface-bright": chat,
      "surface-container-lowest": chat,
      "surface-container-low": sidebar,
      "surface-container": raised,
      "surface-container-high": rail,
      "surface-container-highest": mix(rail, muted, 0.15),
      "on-surface": fg,
      "on-surface-variant": fgVar,
      outline: muted,
      "outline-variant": mix(muted, "#FFFFFF", 0.45),
      "inverse-surface": d.bgChat,
      "inverse-on-surface": d.fgPrimary,
      "inverse-primary": d.accentDefault,
      scrim: "#000000",
      shadow: "#000000",
    };
  }

  const primary = chosen;
  const onPrimary = contrastOn(primary);
  const bgApp = surfaces?.bgApp ?? d.bgApp;
  const bgSidebar = surfaces?.bgSidebar ?? d.bgSidebar;
  const bgChat = surfaces?.bgChat ?? d.bgChat;
  const bgRaised = surfaces?.bgRaised ?? d.bgRaised;
  const bgRail = surfaces?.bgRail ?? d.bgRail;

  return {
    primary,
    "on-primary": onPrimary,
    "primary-container": mix(primary, bgRaised, 0.62),
    "on-primary-container": d.fgPrimary,
    secondary: mix(primary, d.fgMuted, 0.4),
    "on-secondary": d.fgPrimary,
    "secondary-container": mix(bgRaised, primary, 0.18),
    "on-secondary-container": d.fgSecondary,
    tertiary: d.success,
    "on-tertiary": "#0A1A12",
    "tertiary-container": mix(d.success, bgRaised, 0.65),
    "on-tertiary-container": d.fgPrimary,
    error: d.error,
    "on-error": d.onError,
    "error-container": d.errorContainer,
    "on-error-container": d.onErrorContainer,
    "primary-fixed": mix(primary, bgChat, 0.35),
    "primary-fixed-dim": mix(primary, bgChat, 0.5),
    "on-primary-fixed": d.fgPrimary,
    "on-primary-fixed-variant": d.fgSecondary,
    "secondary-fixed": mix(primary, bgRaised, 0.45),
    "secondary-fixed-dim": mix(primary, bgRaised, 0.6),
    "on-secondary-fixed": d.fgPrimary,
    "on-secondary-fixed-variant": d.fgSecondary,
    "tertiary-fixed": mix(d.success, bgRaised, 0.45),
    "tertiary-fixed-dim": mix(d.success, bgRaised, 0.6),
    "on-tertiary-fixed": d.fgPrimary,
    "on-tertiary-fixed-variant": d.fgSecondary,
    "surface-dim": bgApp,
    surface: bgApp,
    "surface-bright": bgRaised,
    "surface-container-lowest": bgApp,
    "surface-container-low": bgSidebar,
    "surface-container": bgChat,
    "surface-container-high": bgRaised,
    "surface-container-highest": bgRail,
    "on-surface": d.fgPrimary,
    "on-surface-variant": d.fgSecondary,
    outline: d.fgMuted,
    "outline-variant": mix(d.fgMuted, bgChat, 0.55),
    "inverse-surface": d.headerPrimary,
    "inverse-on-surface": bgApp,
    "inverse-primary": primary,
    scrim: "#000000",
    shadow: "#000000",
  };
}

/**
 * Semantic `--z-*` tokens for new UI (and Appearance Studio).
 */
export function createZrzurSemanticVariables(
  theme: SelectedTheme & {
    iconAccent?: string;
    iconStyle?: ZrzurIconStyle;
    iconSize?: number;
    iconFill?: number;
    iconGlow?: number;
    radius?: number;
    railWidth?: number;
    sidebarWidth?: number;
    density?: "compact" | "comfortable" | "spacious";
    surfaces?: ZrzurSurfaces;
  },
): Record<string, string> {
  const d = ZRZUR_UNIFIED_DARK;
  const l = ZRZUR_LIGHT;
  const accent = theme.accent || d.accentDefault;
  const pink = isDefaultAccent(accent);
  const dark = theme.darkMode;
  // Chrome icons stay muted. Empty / legacy accent icon
  // accents resolve to the calm chrome grey; only an explicit custom colour
  // overrides. Selected / active roles use --z-icon-active (accent text).
  const rawIcon = theme.iconAccent?.trim() ?? "";
  const iconAccent =
    rawIcon && !same(rawIcon, d.accentDefault) && !isDefaultAccent(rawIcon)
      ? rawIcon
      : dark
        ? d.iconDefault
        : (l.fgMuted as string);
  const surfaces = theme.surfaces;
  // the brand's own shell shades only apply to the default surfaces, so
  // Midnight, Graphite, AMOLED and custom themes look as before
  const brandShell = dark && isDefaultSurfaces(surfaces);

  const fill = pink && !dark ? l.accentFill : fillOf(accent);
  const onAccent = contrastOn(fill);
  const focus = pink
    ? dark
      ? d.accentFocus
      : d.accentStrong
    : dark
      ? mix(accent, "#FFFFFF", 0.35)
      : accent;

  const densityPad =
    theme.density === "compact"
      ? "4px"
      : theme.density === "spacious"
        ? "12px"
        : "8px";

  // density scales real measurements: nav/menu rows and message group spacing
  // (relative to the user's own spacing setting, which stays the baseline)
  const rowHeight =
    theme.density === "compact"
      ? "30px"
      : theme.density === "spacious"
        ? "40px"
        : "34px";
  const baseGroupSpacing = theme.messageGroupSpacing ?? 12;
  const groupSpacing =
    theme.density === "compact"
      ? Math.max(2, baseGroupSpacing - 6)
      : theme.density === "spacious"
        ? baseGroupSpacing + 8
        : baseGroupSpacing;

  const bgApp = dark ? (surfaces?.bgApp ?? d.bgApp) : l.bgApp;
  const bgSidebar = dark ? (surfaces?.bgSidebar ?? d.bgSidebar) : l.bgSidebar;
  const bgChat = dark ? (surfaces?.bgChat ?? d.bgChat) : l.bgChat;
  const bgRaised = dark ? (surfaces?.bgRaised ?? d.bgRaised) : l.bgRaised;
  const live = dark ? d.live : l.live;

  return {
    "--z-bg-app": bgApp,
    "--z-bg-rail": dark ? (surfaces?.bgRail ?? d.bgRail) : l.bgRail,
    "--z-bg-sidebar": bgSidebar,
    "--z-bg-chat": bgChat,
    /*
     * The content surface: headers, chat and (in the brand set) the member
     * list. Floating pieces (account panel, composer) sit on --z-bg-dock.
     */
    "--z-bg-shell": "var(--z-bg-chat)",
    // library themes may add a quiet wash on the chat; none by default
    "--z-shell-gradient": "none",
    /*
     * Button recipes, shared by <Button> and every self-styled button,
     * chip, tab and card. Design direction 2026-11-03: flat fills, borders do
     * the work, and only what floats over content has a shadow.
     */
    "--z-btn-primary-bg": "var(--z-accent-fill)",
    "--z-btn-primary-hover": "var(--z-accent-hover)",
    "--z-btn-lift": "none",
    "--z-btn-surface-bg": "var(--z-slate-1)",
    "--z-btn-surface-hover": "var(--z-slate-2)",
    "--z-btn-surface-border":
      "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    "--z-btn-surface-lift": "none",
    "--z-btn-pressed": "inset 0 0 0 100px rgb(0 0 0 / 0.14)",
    "--z-btn-outline-bg": "transparent",
    "--z-btn-outline-border":
      "color-mix(in srgb, var(--z-fg-primary) 16%, transparent)",
    // text fields: soft well on bg-input
    "--z-field-bg": "var(--z-bg-input)",
    "--z-field-border":
      "color-mix(in srgb, var(--z-fg-primary) 9%, transparent)",
    "--z-field-shadow": "none",
    "--z-field-focus-shadow":
      // a crisp ring, no coloured glow around the field
      "0 0 0 1px var(--z-accent)",
    // floating surfaces: menus, popovers, profile cards, pickers, save bars
    // flat brand ink; the border and the inset top line in --z-popover-lift
    // separate it from what it opens over
    "--z-popover-bg": "var(--z-bg-popover, var(--z-bg-raised))",
    // dialogs and menus share the floating sheet; everything inside steps
    // within one navy family (owner palette 2026-11-01). Library themes
    // derive the same steps from their own floating colour; light mode is a
    // white sheet with mist cards.
    "--z-dialog-bg": dark ? "var(--z-bg-floating)" : "var(--z-bg-chat)",
    "--z-dialog-card": brandShell
      ? d.floatCard
      : dark
        ? "color-mix(in srgb, white 3.5%, var(--z-bg-floating))"
        : "var(--z-bg-sidebar)",
    "--z-float-divider": brandShell
      ? d.floatDivider
      : dark
        ? "color-mix(in srgb, white 9%, var(--z-bg-floating))"
        : "rgb(28 23 36 / 0.09)",
    "--z-float-hover": brandShell
      ? d.floatHover
      : dark
        ? "color-mix(in srgb, white 6%, var(--z-bg-floating))"
        : "color-mix(in srgb, black 4.5%, transparent)",
    "--z-float-label": brandShell ? d.floatLabel : "var(--z-fg-muted)",
    "--z-float-muted": brandShell ? d.floatMuted : "var(--z-fg-muted)",
    "--z-float-icon": brandShell ? d.floatIcon : "var(--z-icon-neutral)",
    "--z-float-tile": brandShell ? d.floatTile : "var(--z-bg-raised)",
    "--z-float-button": brandShell ? d.floatButton : "var(--z-btn-surface-bg)",
    "--z-float-button-hover": brandShell
      ? d.floatButtonHover
      : "var(--z-btn-surface-hover)",
    "--z-float-button-border": brandShell
      ? d.floatButtonBorder
      : "var(--z-btn-surface-border)",
    "--z-float-warning": brandShell ? d.floatWarning : "var(--z-danger)",
    // no accent wash on pop-ups (owner 2026-11-01: the pink at the top did
    // not fit); their touch is the neutral light edge in --z-popover-lift
    "--z-dialog-glow": "none",
    "--z-popover-border": brandShell
      ? d.floatBorder
      : "color-mix(in srgb, var(--z-fg-primary) 11%, transparent)",
    // the one shadow: only what floats over content has it
    "--z-popover-lift": dark
      ? "0 12px 32px rgb(0 0 0 / 0.45)"
      : "0 12px 32px rgb(28 23 36 / 0.16)",
    // one box everywhere (owner, 2026-11-04): the page's ink, a breath lighter
    // at the top, a hairline and a soft lift. A background, not a colour:
    // for a flat value use --z-card-solid
    "--z-card-solid": dark ? "var(--z-bg-sidebar)" : "var(--z-bg-raised)",
    "--z-card-bg": dark
      ? "linear-gradient(180deg, color-mix(in srgb, white 3%, var(--z-card-solid)), var(--z-card-solid))"
      : "var(--z-card-solid)",
    "--z-card-border":
      "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    "--z-card-lift": dark
      ? "inset 0 1px 0 rgb(255 255 255 / 0.04), 0 8px 24px -16px rgb(0 0 0 / 0.6)"
      : "none",
    "--z-card-hover-lift": "none",
    // nested tiles inside a card
    "--z-tile-bg": "var(--z-bg-input)",
    "--z-tile-border":
      "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    // the current tab / choice, raised out of its track
    "--z-tab-active-bg": "var(--z-bg-raised)",
    "--z-tab-active-lift":
      "0 0 0 1px color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    /*
     * Three steps of ink (brand.md): frame (rail) darkest, channel list one
     * up, chat lightest, so the panels separate without lines.
     */
    "--z-bg-nav": "var(--z-bg-sidebar)",
    // member list: same content surface as chat + channel list
    "--z-bg-members": "var(--z-bg-shell)",
    // the frame around the panels: top bar + server rail
    "--z-bg-frame": dark ? bgApp : l.bgRail,
    "--z-titlebar-height": "32px",
    // account panel + composer: the input surface in the brand set,
    // one step off the shell otherwise
    "--z-bg-dock": brandShell
      ? d.bgInput
      : dark
        ? "var(--z-bg-raised)"
        : l.bgDock,
    "--z-bg-raised": bgRaised,
    "--z-bg-floating": brandShell
      ? d.bgFloating
      : dark
        ? `color-mix(in srgb, ${bgApp} 55%, ${bgSidebar})`
        : "#FFFFFF",
    "--z-header-primary": dark ? d.headerPrimary : l.fgPrimary,
    "--z-fg-primary": dark ? d.fgPrimary : l.fgPrimary,
    "--z-fg-secondary": dark ? d.fgSecondary : l.fgSecondary,
    "--z-fg-muted": dark ? d.fgMuted : l.fgMuted,
    "--z-channels-default": dark ? d.channelsDefault : l.fgMuted,
    "--z-accent": accent,
    // hairlines and hovers carry a little of the purple so the dark reads
    // as one tinted family rather than neutral grey
    "--z-border-subtle": dark
      ? "rgb(255 255 255 / 0.06)"
      : "rgb(28 23 36 / 0.09)",
    "--z-border-soft": dark ? d.borderSoft : l.slate2,
    "--z-border-strong": dark ? d.slate2 : "rgb(28 23 36 / 0.17)",
    /*
     * Soft washes. Selected rows stay neutral ink — Raspberry is for
     * actions / focus only, never a purple wash on every active channel.
     */
    "--z-nav-hover": dark
      ? "color-mix(in srgb, white 6%, transparent)"
      : "color-mix(in srgb, black 4.5%, transparent)",
    "--z-nav-selected": dark
      ? brandShell
        ? d.selected
        : "color-mix(in srgb, white 9%, transparent)"
      : "color-mix(in srgb, black 6.5%, transparent)",
    "--z-message-hover": dark
      ? "color-mix(in srgb, white 3.5%, transparent)"
      : "color-mix(in srgb, black 3%, transparent)",
    "--z-hover": "var(--z-nav-hover)",
    "--z-selected": "var(--z-nav-selected)",
    "--z-nav-icon": "var(--z-icon-muted)",
    // rail / unread edge only — not a fill behind every selected row
    "--z-nav-active-bar": "var(--z-unread, var(--z-fg-primary))",
    /*
     * Semantic icon roles. Every role derives from --z-icon-accent, so the
     * Appearance Studio icon accent reaches every icon, but only "active" uses it
     * at full strength — resting icons stay subdued, danger stays red.
     */
    "--z-icon-muted": `color-mix(in srgb, var(--z-fg-muted) 88%, var(--z-icon-accent))`,
    "--z-icon-neutral": `color-mix(in srgb, var(--z-fg-secondary) 90%, var(--z-icon-accent))`,
    "--z-icon-hover": `color-mix(in srgb, var(--z-fg-primary) 86%, var(--z-icon-accent))`,
    "--z-icon-active": pink
      ? dark
        ? d.accentText
        : l.accentText
      : "var(--z-accent-text, var(--z-accent))",
    "--z-icon-danger": "var(--z-danger)",
    "--z-icon-accent": iconAccent,
    "--z-icon-style": "outline",
    "--z-icon-size": `${theme.iconSize ?? 20}px`,
    "--z-icon-fill": String(theme.iconFill ?? 0.22),
    "--z-icon-glow": String(theme.iconGlow ?? 0),
    "--z-radius": `${theme.radius ?? 10}px`,
    // fixed radius scale: fields (xs), small controls, cards/dialogs, panels, pills
    "--z-radius-xs": "4px",
    "--z-radius-sm": "6px",
    "--z-radius-md": "10px",
    "--z-radius-lg": "16px",
    "--z-radius-xl": "16px",
    "--z-radius-pill": "9999px",
    /*
     * One set of shapes for the app, Designs, Discover and the website:
     * only colours differ per area. Taken from what the app's own parts
     * draw (Button, TextField, Segmented, settings cards, Dialog), tied to
     * --z-radius so the user's corner setting reaches every area.
     */
    "--z-shape-button": "var(--z-radius-sm)",
    "--z-shape-chip": "var(--z-radius-sm)",
    "--z-shape-field": "var(--z-radius)",
    "--z-shape-track": "var(--z-radius)",
    "--z-shape-track-item": "calc(var(--z-radius) - 3px)",
    "--z-shape-card": "calc(var(--z-radius) + 4px)",
    "--z-shape-dialog": "calc(var(--z-radius) + 6px)",
    "--z-shape-sheet": "22px",
    "--z-shape-pill": "var(--z-radius-pill)",
    // the big search of Designs and Discover (owner choice 2026-10-30)
    "--z-shape-search": "16px",
    "--z-shape-search-sm": "14px",
    "--z-search-h": "64px",
    "--z-search-h-sm": "48px",
    // control heights (Button sizes xs to xl)
    "--z-control-xs": "28px",
    "--z-control-sm": "32px",
    "--z-control-md": "36px",
    "--z-control-lg": "40px",
    "--z-control-xl": "44px",
    // motion: hovers and small state changes, larger transitions
    "--z-motion-fast": "120ms",
    "--z-motion-base": "220ms",
    "--z-ease-standard": "cubic-bezier(0.2, 0, 0, 1)",
    "--z-rail-width": `${theme.railWidth ?? 72}px`,
    "--z-sidebar-width": `${theme.sidebarWidth ?? 260}px`,
    "--z-member-width": "260px",
    "--z-member-row-height": "44px",
    "--z-ui-text-size": "15px",
    "--z-caption-size": "12px",
    "--z-header-height": "56px",
    "--z-account-bar-height": "60px",
    "--z-composer-min-height": "56px",
    /*
     * Bottom "dock": account panel + message composer — same height, gap,
     * radius, fill, border and lift so they read as one bar across the app.
     */
    "--z-dock-height": "56px",
    "--z-dock-gap": "8px",
    "--z-dock-radius": "12px",
    "--z-dock-bg": "var(--z-bg-dock, var(--z-bg-raised))",
    "--z-dock-border":
      "color-mix(in srgb, var(--z-fg-primary) 9%, transparent)",
    "--z-dock-lift": "none",
    "--z-dock-focus-lift": "0 0 0 1px var(--z-accent)",
    // menus, sub-menus, tooltips, pickers and dialogs share one deep floating
    // ink with a crisp border (it gives the app its
    // weight; a lighter card-coloured float was tried and rejected)
    "--z-bg-popover": "var(--z-bg-floating)",
    "--z-bg-modal": bgChat,
    "--z-bg-input": dark
      ? brandShell
        ? d.bgInput
        : `color-mix(in srgb, ${bgApp} 70%, ${bgChat})`
      : l.bgInput,
    "--z-fg-disabled": dark
      ? "rgb(230 225 238 / 0.32)"
      : "rgb(28 23 36 / 0.35)",
    // filled accent surfaces (buttons, badges, pills with text)
    "--z-accent-fill": fill,
    "--z-accent-strong": fill,
    // hover lifts the accent only as far as the text on it stays readable
    "--z-accent-hover": pink
      ? dark
        ? d.accentHover
        : l.accentHover
      : hoverOf(accent, dark),
    "--z-accent-pressed": pink
      ? dark
        ? d.accentPressed
        : l.accentPressed
      : mix(accent, "#000000", 0.15),
    "--z-accent-muted": `color-mix(in srgb, ${accent} 16%, transparent)`,
    // accent used AS text (links, highlights): lifted so it stays legible
    "--z-accent-text": pink
      ? dark
        ? d.accentText
        : l.accentText
      : dark
        ? mix(accent, "#FFFFFF", 0.45)
        : accent,
    // links and info have their own blue in the default set
    "--z-link": pink ? (dark ? d.link : l.link) : "var(--z-accent-text)",
    // mentions, invites and highlights: the pink
    "--z-highlight": dark ? d.highlight : l.mentionText,
    "--z-highlight-text": dark ? d.highlightLight : l.mentionText,
    "--z-highlight-muted": `color-mix(in srgb, ${d.highlight} 14%, transparent)`,
    "--z-on-accent": onAccent,
    /*
     * The one accent in a few shapes, so headers, tiers and badges never
     * bring their own colours: a lit fill for buttons and bands, and a
     * deep header that fades from the shell into the accent
     */
    "--z-accent-gradient": pink
      ? `linear-gradient(135deg, ${d.accentDefault}, ${d.accentStrong} 60%, ${d.accentHover})`
      : `linear-gradient(135deg, ${mix(accent, "#FFFFFF", 0.16)}, ${accent} 60%, ${mix(accent, "#000000", 0.14)})`,
    // headers stay the app's own dark; the accent only glows in one corner
    "--z-accent-hero": `radial-gradient(90% 120% at 100% 0%, ${mix(accent, d.bgFloating, 0.7)} 0%, transparent 60%), linear-gradient(160deg, ${dark ? bgChat : d.bgChat} 0%, ${d.slate1} 100%)`,
    "--z-accent-deep": mix(accent, d.bgFloating, 0.72),
    "--z-accent-light": pink ? d.accentLight : mix(accent, "#FFFFFF", 0.55),
    "--z-accent-bright": pink
      ? dark
        ? d.accentBright
        : l.accentText
      : mix(accent, "#FFFFFF", 0.3),
    // the neutral ladder (dark mode); light mode steps down from white
    "--z-slate-1": dark ? d.slate1 : l.slate1,
    "--z-slate-2": dark ? d.slate2 : l.slate2,
    "--z-slate-3": dark ? d.slate3 : l.slate3,
    "--z-support": dark ? d.support : l.support,
    "--z-slate-5": dark ? d.slate5 : l.slate5,
    "--z-surface-gradient": dark
      ? `linear-gradient(160deg, ${bgChat}, ${d.slate1})`
      : `linear-gradient(160deg, #FFFFFF, ${l.bgRail})`,
    /*
     * Feather (the member subscription) wears its pink-red gradient; these
     * tokens are for Feather and paid features only
     */
    "--z-feather": ZRZUR_FEATHER.gradient,
    "--z-premium": ZRZUR_FEATHER.solid,
    "--z-premium-text": dark ? ZRZUR_FEATHER.text : l.accentText,
    "--z-premium-light": ZRZUR_FEATHER.light,
    "--z-premium-deep": ZRZUR_FEATHER.deep,
    "--z-on-premium": "#FFFFFF", // white reads at >=4.8:1 across the Feather gradient
    "--z-premium-gradient": ZRZUR_FEATHER.gradient,
    "--z-premium-hero": ZRZUR_FEATHER.hero,
    // Wings (server boosts) only
    "--z-wings-light": ZRZUR_WINGS.light,
    "--z-wings-deep": ZRZUR_WINGS.deep,
    "--z-wings-gradient": ZRZUR_WINGS.gradient,
    "--z-wings-hero": ZRZUR_WINGS.hero,
    // feature accents: --z-<feature>, -text, -muted and --z-on-<feature>
    ...Object.fromEntries(
      Object.entries(ZRZUR_FEATURES).flatMap(([name, f]) => [
        [`--z-${name}`, f.solid],
        [`--z-${name}-text`, dark ? f.textDark : f.textLight],
        [
          `--z-${name}-muted`,
          `color-mix(in srgb, ${f.solid} 14%, transparent)`,
        ],
        [`--z-on-${name}`, f.on],
      ]),
    ),
    // red as text/icons; destructive filled buttons use --z-danger-strong
    "--z-danger": dark ? d.error : l.danger,
    "--z-danger-strong": dark ? d.danger : l.danger,
    "--z-danger-hover": d.dangerHover,
    "--z-on-danger": "#FFFFFF",
    "--z-danger-muted": dark ? "rgb(218 55 60 / 0.16)" : "rgb(180 35 59 / 0.1)",
    /*
     * Green: the one colour for "happening now" (voice connected, someone
     * speaking, online) and success. Never used for static UI.
     */
    "--z-live": live,
    "--z-live-muted": `color-mix(in srgb, ${live} 16%, transparent)`,
    "--z-presence-online": d.live,
    "--z-presence-idle": d.idle,
    "--z-presence-dnd": d.dnd,
    "--z-presence-focus": "#5B9BFF",
    "--z-presence-offline": d.offline,
    "--z-mention-bg": pink
      ? dark
        ? d.mentionBg
        : l.mentionBg
      : `color-mix(in srgb, ${accent} ${dark ? 10 : 8}%, transparent)`,
    "--z-mention-pill": pink
      ? dark
        ? d.mentionPill
        : l.mentionPill
      : `color-mix(in srgb, ${accent} ${dark ? 28 : 16}%, transparent)`,
    "--z-mention-text": pink
      ? dark
        ? d.mentionText
        : l.mentionText
      : "var(--z-accent-text)",
    "--z-mention-bar": pink ? "var(--z-highlight)" : dark ? accent : fill,
    // count badges only — never put white on raw --z-highlight
    "--z-mention-badge": pink ? (dark ? d.mentionBadge : l.mentionBadge) : fill,
    "--z-on-mention-badge": pink
      ? dark
        ? d.onMentionBadge
        : l.onMentionBadge
      : onAccent,
    "--z-mention": "var(--z-mention-badge)",
    "--z-unread": dark ? d.headerPrimary : l.fgPrimary,
    // names on a nameplate in a list: the theme's ink and a halo of the
    // opposite tone, so they read where the plate is faint and where it is not
    "--z-plate-ink": dark ? "#FFFFFF" : l.fgPrimary,
    "--z-plate-ink-halo": dark
      ? "0 0 2px rgb(0 0 0 / 0.6), 0 1px 4px rgb(0 0 0 / 0.7)"
      : "0 0 2px rgb(255 255 255 / 0.95), 0 0 6px rgb(255 255 255 / 0.9), 0 1px 4px rgb(255 255 255 / 0.9)",
    "--z-badge": dark ? d.danger : l.danger,
    "--z-focus": focus,
    "--z-status-success": dark ? d.success : l.success,
    "--z-status-warning": dark ? d.warning : l.warning,
    // components read --z-warning; without it light mode showed dark amber
    "--z-warning": dark ? d.warning : l.warning,
    "--z-status-error": dark ? d.error : l.danger,
    "--z-density-pad": densityPad,
    "--z-row-height": rowHeight,
    "--message-group-spacing": `${groupSpacing}px`,
    /* Restrained atmosphere — a faint accent wash, not a full-scene gradient */
    "--z-atmosphere": "none",
    "--zrzur-bg-app": bgApp,
    "--zrzur-bg-rail": dark ? (surfaces?.bgRail ?? d.bgRail) : l.bgRail,
    "--zrzur-bg-sidebar": bgSidebar,
    "--zrzur-bg-chat": bgChat,
    "--zrzur-bg-raised": bgRaised,
    "--zrzur-text-primary": dark ? d.fgPrimary : l.fgPrimary,
    "--zrzur-text-secondary": dark ? d.fgSecondary : l.fgSecondary,
    "--zrzur-text-muted": dark ? d.fgMuted : l.fgMuted,
    "--zrzur-accent": accent,
    "--z-space-1": "4px",
    "--z-space-2": "8px",
    "--z-space-3": "12px",
    "--z-space-4": "16px",
    "--z-space-5": "20px",
    "--z-space-6": "24px",
    "--z-space-7": "32px",
    "--z-space-8": "40px",
    "--z-space-9": "48px",
    "--z-space-10": "64px",
    "--z-focus-ring": pink
      ? "0 0 0 3px rgb(224 25 95 / 0.4)"
      : `0 0 0 3px color-mix(in srgb, ${focus} 35%, transparent)`,
    "--z-shadow-sm": dark
      ? "0 1px 2px rgba(0,0,0,0.35)"
      : "0 1px 2px rgb(28 23 36 / 0.08)",
    "--z-shadow-md": dark
      ? "0 4px 16px rgba(0,0,0,0.4)"
      : "0 4px 16px rgb(28 23 36 / 0.1)",
    "--z-elev-raised": dark
      ? "rgb(0 0 0 / 0.45) 0 2px 6px, 0 0 0 1px rgb(255 255 255 / 0.05)"
      : "rgb(28 23 36 / 0.12) 0 2px 6px, 0 0 0 1px rgb(28 23 36 / 0.06)",
  };
}
