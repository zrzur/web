import { createSignal } from "solid-js";

import { SelectedTheme } from "@revolt/state/stores/Theme";

import { activeLibraryTheme } from "./themeLibrary";
import { generateZrzurColourScheme } from "./zrzurTheme";

type MaterialYouModule = typeof import("./materialYouScheme");

// The legacy engine is big (Material's colour science) and few use it: it
// loads when asked for, the Zrzur colours show until it is there
const [materialYou, setMaterialYou] = createSignal<MaterialYouModule>();
let materialYouLoading = false;

function materialYouGenerator() {
  if (!materialYouLoading) {
    materialYouLoading = true;
    void import("./materialYouScheme").then(setMaterialYou);
  }
  return materialYou()?.generateMaterialYouScheme;
}

/**
 * Generate colour variables from the given properties.
 *
 * Default path: Zrzur Unified Dark (Material-compatible keys).
 * Legacy Material You remains available when `theme.colourEngine === "material-you"`.
 */
/** Surfaces of a light library theme, when one is in effect */
function lightLibrarySurfaces(theme: SelectedTheme) {
  const t = activeLibraryTheme(theme);
  if (!t || t.mode !== "light") return;
  return {
    bgApp: t.rail,
    bgRail: t.rail,
    bgSidebar: t.nav,
    bgChat: t.chat,
    bgRaised: t.raised,
    fgPrimary: t.fg,
    fgSecondary: t.fg2,
    fgMuted: t.muted,
  };
}

/** Surfaces of the dark library theme in effect, if any */
function darkLibrarySurfaces(theme: SelectedTheme) {
  const t = activeLibraryTheme(theme);
  if (!t || t.mode !== "dark") return;
  return {
    bgApp: t.rail,
    bgRail: t.rail,
    bgSidebar: t.nav,
    bgChat: t.chat,
    bgRaised: t.raised,
  };
}

export function createMaterialColourVariables<P extends string>(
  theme: SelectedTheme,
  prefix: P,
): addPrefixToObject<MaterialColours, P> {
  const generateMaterialYou =
    theme.colourEngine === "material-you" ? materialYouGenerator() : undefined;

  const scheme = generateMaterialYou
    ? generateMaterialYou(
        theme.accent,
        theme.darkMode,
        theme.contrast,
        theme.variant,
      )
    : generateZrzurColourScheme(
        // a library theme brings its own accent and surfaces, also in
        // dark mode (older parts of the app read these colours)
        activeLibraryTheme(theme)?.accent ?? theme.accent,
        theme.darkMode,
        darkLibrarySurfaces(theme) ?? theme.surfaces,
        lightLibrarySurfaces(theme),
      );

  return Object.entries(scheme).reduce(
    (d, [key, value]) => ({
      ...d,
      [`${prefix}${key}`]: value,
    }),
    {} as addPrefixToObject<MaterialColours, P>,
  );
}

/**
 * Create R,G,B triplets for MDUI variables
 */
export function createMduiColourTriplets<P extends string>(
  theme: SelectedTheme,
  prefix: P,
): addPrefixToObject<MaterialColours, P> {
  const variables = createMaterialColourVariables(theme, prefix);

  for (const key in variables) {
    const [_, r, g, b] = /#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})/i.exec(
      variables[key as keyof typeof variables] as string,
    )!;

    (variables as Record<string, string>)[key] =
      `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}`;
  }

  return variables;
}

type addPrefixToObject<T, P extends string> = {
  [K in keyof T as K extends string ? `${P}${K}` : never]: T[K];
};

type _addSuffixToObject<T, S extends string> = {
  [K in keyof T as K extends string ? `${K}${S}` : never]: T[K];
};

export type MaterialColours = {
  primary: string;
  "on-primary": string;
  "primary-container": string;
  "on-primary-container": string;
  secondary: string;
  "on-secondary": string;
  "secondary-container": string;
  "on-secondary-container": string;
  tertiary: string;
  "on-tertiary": string;
  "tertiary-container": string;
  "on-tertiary-container": string;
  error: string;
  "on-error": string;
  "error-container": string;
  "on-error-container": string;

  "primary-fixed": string;
  "primary-fixed-dim": string;
  "on-primary-fixed": string;
  "on-primary-fixed-variant": string;
  "secondary-fixed": string;
  "secondary-fixed-dim": string;
  "on-secondary-fixed": string;
  "on-secondary-fixed-variant": string;
  "tertiary-fixed": string;
  "tertiary-fixed-dim": string;
  "on-tertiary-fixed": string;
  "on-tertiary-fixed-variant": string;

  "surface-dim": string;
  surface: string;
  "surface-bright": string;

  "surface-container-lowest": string;
  "surface-container-low": string;
  "surface-container": string;
  "surface-container-high": string;
  "surface-container-highest": string;

  "on-surface": string;
  "on-surface-variant": string;
  outline: string;
  "outline-variant": string;

  "inverse-surface": string;
  "inverse-on-surface": string;
  "inverse-primary": string;

  scrim: string;
  shadow: string;
};
