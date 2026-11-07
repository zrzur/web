/**
 * Interface and code fonts for Appearance.
 *
 * All faces ship via `@fontsource` / `@fontsource-variable` (OFL-1.1 or
 * Apache-2.0 upstream). No proprietary Discord / Stoat fonts.
 * OpenDyslexic and Atkinson Hyperlegible stay for accessibility.
 */

/**
 * Zrzur's Arabic face (brand.md: IBM Plex Sans Arabic, OFL-1.1). Loaded for
 * everyone, whatever interface font is picked: only its Arabic subset is
 * included and its @font-face rules carry an Arabic unicode-range, so the
 * browser downloads it only when Arabic text is on screen and Latin text
 * keeps the chosen font.
 */
export const ARABIC_FONT = "IBM Plex Sans Arabic";

let arabicLoading: Promise<void> | undefined;
export function loadArabicFont() {
  arabicLoading ??= (async () => {
    await import("@fontsource/ibm-plex-sans-arabic/arabic-400.css");
    await import("@fontsource/ibm-plex-sans-arabic/arabic-500.css");
    await import("@fontsource/ibm-plex-sans-arabic/arabic-600.css");
    await import("@fontsource/ibm-plex-sans-arabic/arabic-700.css");
  })();
  return arabicLoading;
}

export const FONTS = {
  Inter: {
    load: async () => {
      await import("@fontsource/inter/400.css");
      await import("@fontsource/inter/500.css");
      await import("@fontsource/inter/600.css");
      await import("@fontsource/inter/700.css");
    },
  },

  "Open Sans": {
    load: async () => {
      await import("@fontsource/open-sans/300.css");
      await import("@fontsource/open-sans/400.css");
      await import("@fontsource/open-sans/500.css");
      await import("@fontsource/open-sans/600.css");
      await import("@fontsource/open-sans/700.css");
      await import("@fontsource/open-sans/400-italic.css");
    },
  },

  OpenDyslexic: {
    load: async () => {
      await import("@fontsource/opendyslexic/400.css");
      await import("@fontsource/opendyslexic/700.css");
      await import("@fontsource/opendyslexic/400-italic.css");
    },
  },

  "Atkinson Hyperlegible": {
    load: async () => {
      await import("@fontsource/atkinson-hyperlegible/400.css");
      await import("@fontsource/atkinson-hyperlegible/700.css");
      await import("@fontsource/atkinson-hyperlegible/400-italic.css");
    },
  },
  Roboto: {
    load: async () => {
      await import("@fontsource/roboto/400.css");
      await import("@fontsource/roboto/700.css");
      await import("@fontsource/roboto/400-italic.css");
    },
  },
  "Noto Sans": {
    load: async () => {
      await import("@fontsource/noto-sans/400.css");
      await import("@fontsource/noto-sans/700.css");
      await import("@fontsource/noto-sans/400-italic.css");
    },
  },
  "Noto Sans Arabic": {
    load: async () => {
      await import("@fontsource/noto-sans-arabic/400.css");
      await import("@fontsource/noto-sans-arabic/500.css");
      await import("@fontsource/noto-sans-arabic/700.css");
    },
  },
  Bitter: {
    load: async () => {
      await import("@fontsource/bitter/300.css");
      await import("@fontsource/bitter/400.css");
      await import("@fontsource/bitter/600.css");
      await import("@fontsource/bitter/700.css");
    },
  },
  Lato: {
    load: async () => {
      await import("@fontsource/lato/300.css");
      await import("@fontsource/lato/400.css");
      await import("@fontsource/lato/700.css");
      await import("@fontsource/lato/400-italic.css");
    },
  },
  Lexend: {
    load: async () => {
      await import("@fontsource/lexend/300.css");
      await import("@fontsource/lexend/400.css");
      await import("@fontsource/lexend/700.css");
    },
  },
  Montserrat: {
    load: async () => {
      await import("@fontsource/montserrat/300.css");
      await import("@fontsource/montserrat/400.css");
      await import("@fontsource/montserrat/600.css");
      await import("@fontsource/montserrat/700.css");
      await import("@fontsource/montserrat/400-italic.css");
    },
  },
  Poppins: {
    load: async () => {
      await import("@fontsource/poppins/300.css");
      await import("@fontsource/poppins/400.css");
      await import("@fontsource/poppins/600.css");
      await import("@fontsource/poppins/700.css");
      await import("@fontsource/poppins/400-italic.css");
    },
  },
  Raleway: {
    load: async () => {
      await import("@fontsource/raleway/300.css");
      await import("@fontsource/raleway/400.css");
      await import("@fontsource/raleway/600.css");
      await import("@fontsource/raleway/700.css");
      await import("@fontsource/raleway/400-italic.css");
    },
  },
  Ubuntu: {
    load: async () => {
      await import("@fontsource/ubuntu/300.css");
      await import("@fontsource/ubuntu/400.css");
      await import("@fontsource/ubuntu/500.css");
      await import("@fontsource/ubuntu/700.css");
      await import("@fontsource/ubuntu/400-italic.css");
    },
  },
  "Comic Neue": {
    load: async () => {
      await import("@fontsource/comic-neue/300.css");
      await import("@fontsource/comic-neue/400.css");
      await import("@fontsource/comic-neue/700.css");
      await import("@fontsource/comic-neue/400-italic.css");
    },
  },
  "IBM Plex Sans Variable": {
    load: async () => {
      await import("@fontsource-variable/ibm-plex-sans/index.css");
    },
  },
  "IBM Plex Serif": {
    load: async () => {
      await import("@fontsource/ibm-plex-serif/400.css");
      await import("@fontsource/ibm-plex-serif/600.css");
      await import("@fontsource/ibm-plex-serif/700.css");
    },
  },
  "Plus Jakarta Sans Variable": {
    load: async () => {
      await import("@fontsource-variable/plus-jakarta-sans/index.css");
    },
  },
  "DM Sans": {
    load: async () => {
      await import("@fontsource/dm-sans/400.css");
      await import("@fontsource/dm-sans/500.css");
      await import("@fontsource/dm-sans/700.css");
    },
  },
  Nunito: {
    load: async () => {
      await import("@fontsource/nunito/400.css");
      await import("@fontsource/nunito/600.css");
      await import("@fontsource/nunito/700.css");
    },
  },
  Figtree: {
    load: async () => {
      await import("@fontsource/figtree/400.css");
      await import("@fontsource/figtree/500.css");
      await import("@fontsource/figtree/600.css");
      await import("@fontsource/figtree/700.css");
    },
  },
  Manrope: {
    load: async () => {
      await import("@fontsource/manrope/400.css");
      await import("@fontsource/manrope/500.css");
      await import("@fontsource/manrope/600.css");
      await import("@fontsource/manrope/700.css");
    },
  },
  Rubik: {
    load: async () => {
      await import("@fontsource/rubik/400.css");
      await import("@fontsource/rubik/500.css");
      await import("@fontsource/rubik/600.css");
      await import("@fontsource/rubik/700.css");
    },
  },
  "Work Sans": {
    load: async () => {
      await import("@fontsource/work-sans/400.css");
      await import("@fontsource/work-sans/500.css");
      await import("@fontsource/work-sans/600.css");
      await import("@fontsource/work-sans/700.css");
    },
  },
  "Source Sans 3": {
    load: async () => {
      await import("@fontsource/source-sans-3/400.css");
      await import("@fontsource/source-sans-3/600.css");
      await import("@fontsource/source-sans-3/700.css");
    },
  },
  Karla: {
    load: async () => {
      await import("@fontsource/karla/400.css");
      await import("@fontsource/karla/500.css");
      await import("@fontsource/karla/700.css");
    },
  },
  Outfit: {
    load: async () => {
      await import("@fontsource/outfit/400.css");
      await import("@fontsource/outfit/500.css");
      await import("@fontsource/outfit/600.css");
      await import("@fontsource/outfit/700.css");
    },
  },
};

export const MONOSPACE_FONTS = {
  "JetBrains Mono": {
    load: async () => {
      await import("@fontsource/jetbrains-mono/400.css");
      await import("@fontsource/jetbrains-mono/500.css");
      await import("@fontsource/jetbrains-mono/700.css");
    },
  },
  "Fira Code": {
    load: () => import("@fontsource/fira-code/400.css"),
  },
  "Roboto Mono": {
    load: () => import("@fontsource/roboto-mono/400.css"),
  },
  "Source Code Pro": {
    load: () => import("@fontsource/source-code-pro/400.css"),
  },
  "Space Mono": {
    load: () => import("@fontsource/space-mono/400.css"),
  },
  "Ubuntu Mono": {
    load: () => import("@fontsource/ubuntu-mono/400.css"),
  },
  "IBM Plex Mono": {
    load: () => import("@fontsource/ibm-plex-mono/400.css"),
  },
};

export type Fonts = keyof typeof FONTS;
export type MonospaceFonts = keyof typeof MONOSPACE_FONTS;

export const FONT_KEYS = Object.keys(FONTS).sort();
export const MONOSPACE_FONT_KEYS = Object.keys(MONOSPACE_FONTS).sort();

export const DEFAULT_FONT = "IBM Plex Sans Variable";
export const DEFAULT_MONO_FONT = "IBM Plex Mono";
