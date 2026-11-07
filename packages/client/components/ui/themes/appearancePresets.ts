import { THEME_LIBRARY } from "./themeLibrary";
import { ZRZUR_LIGHT, ZRZUR_UNIFIED_DARK } from "./zrzurTheme";

export type AppearancePresetId =
  | "signature-dark"
  | "graphite"
  | "amoled"
  | "daylight"
  | "custom"
  | (string & {});

export type AppearancePreset = {
  id: AppearancePresetId;
  name: string;
  description: string;
  accent: string;
  /** Muted chrome for outline icons — never the action accent */
  iconAccent: string;
  /** Preview swatches: app / sidebar / chat / raised */
  swatches: [string, string, string, string];
  mode: "dark" | "light";
  /** All curated packs live in one flat Zrzur grid */
  collection: "zrzur";
  /** small extra dots on the tile: highlight and link colours */
  dots?: string[];
  radius?: number;
  density?: "compact" | "comfortable" | "spacious";
};

const d = ZRZUR_UNIFIED_DARK;
const l = ZRZUR_LIGHT;

/**
 * Four Appearance packs. Every dark pack keeps Raspberry + Neon Pink
 * + link blue as the role colours so the product stays one family; only the
 * ink ladder changes (midnight / graphite / near-black OLED / daylight).
 */
export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: "signature-dark",
    name: "Midnight Pulse",
    description:
      "Gaming dark: deep midnight panels, Raspberry for actions and Neon Pink for highlights.",
    accent: d.accentDefault,
    iconAccent: d.iconDefault,
    swatches: [d.bgApp, d.bgSidebar, d.bgChat, d.bgRaised],
    mode: "dark",
    collection: "zrzur",
    density: "comfortable",
    dots: [d.highlight, d.link],
  },
  {
    id: "graphite",
    name: "Graphite",
    description:
      "Cool graphite panels for long sessions. Same raspberry actions and pink highlights.",
    accent: d.accentDefault,
    iconAccent: "#A8ADB8",
    // cool grey ladder — same steps as Midnight, less blue
    swatches: ["#101114", "#17191E", "#1E2128", "#282C34"],
    mode: "dark",
    collection: "zrzur",
    dots: [d.highlight, d.link],
  },
  {
    id: "amoled",
    name: "AMOLED",
    description:
      "Near-black for OLED screens. Soft steps so the eye stays comfortable.",
    accent: d.accentDefault,
    iconAccent: d.iconDefault,
    // true black rail, soft charcoal chat (not flat #121212 glare)
    swatches: ["#000000", "#070708", "#0E0E10", "#18181C"],
    mode: "dark",
    collection: "zrzur",
    dots: [d.highlight, d.link],
  },
  {
    id: "daylight",
    name: "Daylight",
    description:
      "Clean light surfaces with deep ink text and Raspberry actions.",
    accent: d.accentDefault,
    iconAccent: l.fgMuted,
    swatches: [l.bgApp, l.bgSidebar, l.bgChat, l.bgRaised],
    mode: "light",
    collection: "zrzur",
    dots: [l.mentionText, l.link],
  },
];

/** Library themes with a place on the Appearance page, after the four packs */
const LISTED_LIBRARY_THEMES = ["high-contrast", "paper", "desert-dawn"];

export const LISTED_THEME_PRESETS: AppearancePreset[] =
  LISTED_LIBRARY_THEMES.map((id) => {
    const theme = THEME_LIBRARY.find((t) => t.id === id)!;
    return {
      id,
      name: theme.name,
      description: theme.description ?? "",
      accent: theme.accent,
      iconAccent: theme.muted,
      swatches: [theme.rail, theme.nav, theme.chat, theme.raised],
      mode: theme.mode,
      collection: "zrzur",
      dots: [theme.highlight, theme.link],
    };
  });

export function getAppearancePreset(
  id: string | undefined,
): AppearancePreset | undefined {
  return [...APPEARANCE_PRESETS, ...LISTED_THEME_PRESETS].find(
    (p) => p.id === id,
  );
}
