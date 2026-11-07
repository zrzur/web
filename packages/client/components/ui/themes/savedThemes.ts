import {
  type Fonts,
  type MonospaceFonts,
  FONT_KEYS,
  MONOSPACE_FONT_KEYS,
} from "./fonts";

// Hand-written checks instead of a schema library: this runs at startup
// (the theme store), and zod alone was 86 KB of the first load.

const SURFACE_KEYS = [
  "bgApp",
  "bgRail",
  "bgSidebar",
  "bgChat",
  "bgRaised",
] as const;

export type ThemeSnapshot = {
  mode: "dark" | "light" | "system";
  m3Accent: string;
  iconAccent: string;
  iconStyle: "outline" | "filled" | "expressive";
  iconSize: number;
  iconFill: number;
  radius: number;
  railWidth: number;
  sidebarWidth: number;
  density: "compact" | "comfortable" | "spacious";
  blur: boolean;
  interfaceFont: Fonts;
  monospaceFont: MonospaceFonts;
  messageSize: number;
  messageGroupSpacing: number;
  surfaces?: Partial<Record<(typeof SURFACE_KEYS)[number], string>>;
};

export type SavedTheme = {
  version: 1;
  name: string;
  settings: ThemeSnapshot;
};

export const SAVED_THEME_KEY = "zrzur.saved-themes.v1";

/** Reject an invalid value (the message names the field) */
function fail(field: string): never {
  throw new TypeError(`Invalid theme setting: ${field}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Only these keys may be present (no CSS, scripts or unknown settings) */
function onlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(key);
}

function hex(value: unknown, field: string) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) fail(field);
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  field: string,
) {
  if (
    typeof value !== "string" ||
    !(options as readonly string[]).includes(value)
  )
    fail(field);
  return value as T;
}

function number(
  value: unknown,
  min: number,
  max: number,
  field: string,
  integer = false,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    fail(field);
  return value;
}

const SNAPSHOT_KEYS = [
  "mode",
  "m3Accent",
  "iconAccent",
  "iconStyle",
  "iconSize",
  "iconFill",
  "radius",
  "railWidth",
  "sidebarWidth",
  "density",
  "blur",
  "interfaceFont",
  "monospaceFont",
  "messageSize",
  "messageGroupSpacing",
  "surfaces",
] as const;

/**
 * Check a theme's settings
 * @param input Untrusted value
 * @returns The same settings, typed
 */
function parseSnapshot(input: unknown): ThemeSnapshot {
  if (!isObject(input)) fail("settings");
  onlyKeys(input, SNAPSHOT_KEYS);
  if (typeof input.blur !== "boolean") fail("blur");

  const snapshot: ThemeSnapshot = {
    mode: oneOf(input.mode, ["dark", "light", "system"], "mode"),
    m3Accent: hex(input.m3Accent, "m3Accent"),
    iconAccent: hex(input.iconAccent, "iconAccent"),
    iconStyle: oneOf(
      input.iconStyle,
      ["outline", "filled", "expressive"],
      "iconStyle",
    ),
    iconSize: number(input.iconSize, 12, 32, "iconSize", true),
    iconFill: number(input.iconFill, 0, 1, "iconFill"),
    radius: number(input.radius, 0, 24, "radius"),
    railWidth: number(input.railWidth, 48, 100, "railWidth"),
    sidebarWidth: number(input.sidebarWidth, 180, 360, "sidebarWidth"),
    density: oneOf(
      input.density,
      ["compact", "comfortable", "spacious"],
      "density",
    ),
    blur: input.blur,
    interfaceFont: oneOf(
      input.interfaceFont,
      FONT_KEYS as Fonts[],
      "interfaceFont",
    ),
    monospaceFont: oneOf(
      input.monospaceFont,
      MONOSPACE_FONT_KEYS as MonospaceFonts[],
      "monospaceFont",
    ),
    messageSize: number(input.messageSize, 12, 24, "messageSize"),
    messageGroupSpacing: number(
      input.messageGroupSpacing,
      0,
      64,
      "messageGroupSpacing",
    ),
  };

  if (input.surfaces !== undefined) {
    if (!isObject(input.surfaces)) fail("surfaces");
    onlyKeys(input.surfaces, SURFACE_KEYS);
    const surfaces: NonNullable<ThemeSnapshot["surfaces"]> = {};
    for (const key of SURFACE_KEYS) {
      const value = input.surfaces[key];
      if (value !== undefined) surfaces[key] = hex(value, `surfaces.${key}`);
    }
    snapshot.surfaces = surfaces;
  }

  return snapshot;
}

/**
 * Check a saved theme
 * @param input Untrusted value
 * @returns The same theme, typed
 */
function parseSavedTheme(input: unknown): SavedTheme {
  if (!isObject(input)) fail("theme");
  onlyKeys(input, ["version", "name", "settings"]);
  if (input.version !== 1) fail("version");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 1 || name.length > 60) fail("name");
  return { version: 1, name, settings: parseSnapshot(input.settings) };
}

function parseSavedThemes(input: unknown): SavedTheme[] {
  if (!Array.isArray(input) || input.length > 32) fail("themes");
  return input.map(parseSavedTheme);
}

/** Theme settings, checked (throws on anything else) */
export const themeSnapshotSchema = { parse: parseSnapshot };

export function parseThemeImport(source: string): SavedTheme {
  if (source.length > 65536)
    throw new Error("Theme files must be smaller than 64 KB.");
  return parseSavedTheme(JSON.parse(source));
}

export function readSavedThemes(): SavedTheme[] {
  return parseSavedThemes(
    JSON.parse(localStorage.getItem(SAVED_THEME_KEY) ?? "[]"),
  );
}

export function writeSavedThemes(themes: SavedTheme[]) {
  const validated = parseSavedThemes(themes);
  localStorage.setItem(SAVED_THEME_KEY, JSON.stringify(validated));
}
