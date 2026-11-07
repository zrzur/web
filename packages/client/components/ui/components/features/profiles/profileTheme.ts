import { JSX } from "solid-js";

/**
 * A profile's own colours, taken from its banner (or avatar): the average
 * colour of the top and bottom halves, toned for a dark surface. Gives
 * every profile its own gradient without storing anything extra.
 */
export type ProfileTheme = { top: string; bottom: string };

const cache = new Map<string, Promise<ProfileTheme | undefined>>();

/** Keep colours rich but dark enough for white text on top */
export function toneForSurface([r, g, b]: number[]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r / 255) hue = ((g - b) / 255 / delta) % 6;
    else if (max === g / 255) hue = (b - r) / 255 / delta + 2;
    else hue = (r - g) / 255 / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  const s = Math.round(Math.min(0.75, Math.max(0.25, saturation)) * 100);
  const l = Math.round(Math.min(0.42, Math.max(0.22, lightness)) * 100);
  return `hsl(${Math.round(hue)} ${s}% ${l}%)`;
}

function average(data: Uint8ClampedArray, from: number, to: number) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = from; i < to; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent pixels
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return n ? [r / n, g / n, b / n] : undefined;
}

/** The same two colours for the same seed (a user id), never random */
export function seededTheme(
  seed: string | undefined,
): ProfileTheme | undefined {
  if (!seed) return;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return {
    top: `hsl(${hue} 42% 34%)`,
    bottom: `hsl(${(hue + 28) % 360} 38% 22%)`,
  };
}

export function readProfileTheme(url: string | undefined) {
  // default avatars come from the API without CORS, so their pixels can't be
  // read; skip them instead of logging an error (the seeded colour is used)
  if (
    !url ||
    typeof document === "undefined" ||
    url.includes("/default_avatar")
  )
    return Promise.resolve(undefined);
  let entry = cache.get(url);
  if (!entry) {
    entry = new Promise<ProfileTheme | undefined>((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => {
        try {
          const size = 16;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return resolve(undefined);
          context.drawImage(image, 0, 0, size, size);
          const { data } = context.getImageData(0, 0, size, size);
          const half = data.length / 2;
          const top = average(data, 0, half);
          const bottom = average(data, half, data.length) ?? top;
          resolve(
            top && bottom
              ? { top: toneForSurface(top), bottom: toneForSurface(bottom) }
              : undefined,
          );
        } catch {
          // the media server didn't allow reading the pixels
          resolve(undefined);
        }
      };
      image.onerror = () => resolve(undefined);
      image.src = url;
    });
    cache.set(url, entry);
  }
  return entry;
}

/**
 * CSS variables for a profile surface in the colours the user picked.
 * Without a picked theme the profile keeps the site's own default look
 * (nothing is guessed from the avatar or banner).
 */
export function createProfileTheme(
  // kept for callers; profiles are no longer coloured from their images
  _source: () => string | undefined,
  _seed?: () => string | undefined,
  /** colours the user picked themselves */
  chosen?: () => ProfileTheme | undefined,
) {
  return (): JSX.CSSProperties => {
    const picked = chosen?.();
    if (!picked) return {};
    const theme = readableTheme(picked);
    const ink = (amount: number) => overlay(theme.ink, amount);
    const away = (amount: number) => overlay(theme.away, amount);
    const chipSolid = mixColours(theme.top, theme.away, theme.chipAmount);
    return {
      "--profile-top": theme.top,
      "--profile-bottom": theme.bottom,
      // no solid ring around the avatar: the gradient shows through
      "--profile-surface": "transparent",
      "--profile-ink": theme.ink,
      "--profile-ink-2": ink(theme.mutedAmount),
      "--profile-line": ink(0.12),
      "--profile-accent": theme.ink,
      "--profile-ring": theme.top,
      // chips and fields: the darker see-through tint of the chosen colours
      "--profile-chip": away(theme.chipAmount),
      "--profile-chip-hover": away(theme.chipAmount * 1.5),
      "--profile-bubble": chipSolid,
      "--profile-banner-bg": ink(0.04),
      "--profile-banner-fallback": "none",
      // shared controls inside the card read the same colours
      "--z-fg-primary": theme.ink,
      "--z-fg-secondary": ink(theme.secondaryAmount),
      "--z-fg-muted": ink(theme.mutedAmount),
      "--z-border-subtle": ink(0.12),
      "--z-link": theme.ink,
      "--z-accent-text": theme.ink,
      "--z-focus": theme.ink,
      "--z-icon-muted": ink(theme.mutedAmount),
      "--z-icon-hover": theme.ink,
      "--z-nav-hover": away(theme.chipAmount),
      "--z-nav-selected": away(theme.chipAmount * 1.5),
      "--z-btn-tonal-bg": chipSolid,
      "--z-btn-tonal-border": ink(0.1),
      "--z-btn-tonal-hover": mixColours(
        theme.top,
        theme.away,
        theme.chipAmount * 1.5,
      ),
      background: `linear-gradient(180deg, ${theme.top} 0%, ${theme.bottom} 100%)`,
    };
  };
}

const AA = 4.5;
const SECONDARY = 0.92;
const MUTED = 0.84;
const CHIP = 0.24;
const INK = "#ffffff";
const SHADE = "#000000";
/** Every theme is deepened this far, toward the app's darkest surface */
const DEEPEN_TO = "#11121c";
const DEEPEN = 0.22;

const channels = (colour: string) =>
  [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));

const hexOf = (value: number[]) =>
  `#${value.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;

/** `amount` of `to` over `from`, as a translucent layer would paint it */
export function mixColours(from: string, to: string, amount: number) {
  const end = channels(to);
  return hexOf(channels(from).map((n, i) => n + (end[i] - n) * amount));
}

function luminance(colour: string) {
  const [r, g, b] = channels(colour).map((n) => {
    const c = n / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two `#rrggbb` colours */
export function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const overlay = (colour: string, amount: number) =>
  `rgb(${channels(colour).join(" ")} / ${Math.round(amount * 100)}%)`;

/** Points along a gradient: its darkest point may lie between the ends */
const along = (top: string, bottom: string) =>
  [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((t) =>
    mixColours(top, bottom, t),
  );

/** The weakest contrast of this text on these surfaces */
const weakest = (ink: string, amount: number, surfaces: string[]) =>
  Math.min(
    ...surfaces.map((surface) =>
      contrast(mixColours(surface, ink, amount), surface),
    ),
  );

export type ReadableTheme = ProfileTheme & {
  /** Solid colour of all text on the card */
  ink: string;
  /** The opposite pole: chips and fields lean this way, so text gains */
  away: string;
  secondaryAmount: number;
  mutedAmount: number;
  chipAmount: number;
};

/**
 * The chosen colours, deepened so light text reads on them. Every theme gets
 * the same base deepening; a pale one goes further, only as far as it takes,
 * and text stays light whatever the choice.
 */
export function readableTheme(chosen: ProfileTheme): ReadableTheme {
  let top = chosen.top;
  let bottom = chosen.bottom;
  for (let deepen = DEEPEN; deepen <= 1; deepen += 0.02) {
    top = mixColours(chosen.top, DEEPEN_TO, deepen);
    bottom = mixColours(chosen.bottom, DEEPEN_TO, deepen);
    if (weakest(INK, MUTED, along(top, bottom)) >= AA) break;
  }

  return {
    top,
    bottom,
    ink: INK,
    away: SHADE,
    secondaryAmount: SECONDARY,
    mutedAmount: MUTED,
    chipAmount: CHIP,
  };
}

/** Whether a person's name colours read everywhere on their own theme */
export function readableName(colours: string[], theme: ReadableTheme) {
  const surfaces = along(theme.top, theme.bottom);
  return colours.every((colour) =>
    surfaces.every((surface) => contrast(colour, surface) >= AA),
  );
}
