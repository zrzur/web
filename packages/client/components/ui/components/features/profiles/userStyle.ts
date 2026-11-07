import type { JSX } from "solid-js";

/**
 * A user's chosen look, as stored by the API on the user object
 * (`style`). The server only accepts the ids and `#rrggbb` colours below,
 * so these values are safe to put into inline styles.
 */
export type UserStyle = {
  theme?: string[];
  name_font?: string;
  name_colour?: string[];
  /** built-in id, or `c:<id>` for a community decoration */
  decoration?: string;
  /** image of a community decoration (filled in by the server) */
  decoration_file?: string;
  /** built-in id, or `c:<id>` for a community nameplate */
  nameplate?: string;
  /** image of a community nameplate (filled in by the server) */
  nameplate_file?: string;
  /** one of Zrzur's own effects, or `c:<id>` of a community effect */
  effect?: string;
  /** file of a community effect (filled in by the server) */
  effect_file?: string;
};

/** Read the style the API attached to a user (absent on older servers) */
export function userStyleOf(user: unknown): UserStyle | undefined {
  const style = (user as { style?: UserStyle } | undefined)?.style;
  if (!style || typeof style !== "object") return undefined;
  // a design we no longer ship counts as none, so saving still works
  const { decoration, nameplate } = style;
  const staleDecoration =
    decoration &&
    !isCommunityRef(decoration) &&
    !(DECORATIONS as readonly string[]).includes(decoration);
  const stalePlate =
    nameplate &&
    !isCommunityRef(nameplate) &&
    !NAMEPLATES.some((plate) => plate.id === nameplate);
  if (!staleDecoration && !stalePlate) return style;
  const rest = { ...style };
  if (staleDecoration) {
    delete rest.decoration;
    delete rest.decoration_file;
  }
  if (stalePlate) {
    delete rest.nameplate;
    delete rest.nameplate_file;
  }
  return rest;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const colours = (list: unknown) =>
  Array.isArray(list) ? list.filter((c) => HEX.test(c)).slice(0, 2) : [];

/** Keeps Arabic in Zrzur's own face when a font has no Arabic of its own */
const ARABIC = "'IBM Plex Sans Arabic'";

/**
 * Display-name fonts: what ships with the system, and open fonts already in
 * the app (all SIL OFL 1.1, see `public/decorations/SOURCES.md`), each loaded
 * the first time a name uses it.
 */
export const NAME_FONTS: {
  id: string;
  family: string;
  weight?: number;
  extra?: JSX.CSSProperties;
  load?: () => Promise<unknown>;
}[] = [
  { id: "default", family: "inherit" },
  { id: "bold", family: "inherit", weight: 800 },
  {
    id: "serif",
    family: `Georgia, 'Times New Roman', 'Noto Serif', ${ARABIC}, serif`,
    weight: 700,
  },
  {
    id: "mono",
    family: `'JetBrains Mono', 'Cascadia Code', Consolas, 'Courier New', ${ARABIC}, monospace`,
    weight: 700,
  },
  {
    id: "script",
    family: `'Segoe Script', 'Brush Script MT', 'Comic Sans MS', ${ARABIC}, cursive`,
    weight: 700,
  },
  {
    id: "pixel",
    family: `'Courier New', ${ARABIC}, monospace`,
    weight: 800,
    extra: { "text-transform": "uppercase", "letter-spacing": "0.08em" },
  },
  {
    id: "wide",
    family: "inherit",
    weight: 800,
    extra: { "text-transform": "uppercase", "letter-spacing": "0.14em" },
  },
  {
    id: "rounded",
    family: `'Nunito', 'Varela Round', 'Arial Rounded MT Bold', ${ARABIC}, system-ui, sans-serif`,
    weight: 800,
    load: () => import("@fontsource/nunito/800.css"),
  },
  {
    id: "geo",
    family: `'Outfit', ${ARABIC}, sans-serif`,
    weight: 700,
    load: () => import("@fontsource/outfit/700.css"),
  },
  {
    id: "modern",
    family: `'Poppins', ${ARABIC}, sans-serif`,
    weight: 700,
    load: () => import("@fontsource/poppins/700.css"),
  },
  {
    id: "elegant",
    family: `'Raleway', ${ARABIC}, sans-serif`,
    weight: 700,
    extra: { "letter-spacing": "0.02em" },
    load: () => import("@fontsource/raleway/700.css"),
  },
  {
    id: "strong",
    family: `'Montserrat', ${ARABIC}, sans-serif`,
    weight: 800,
    load: () => import("@fontsource/montserrat/800.css"),
  },
  {
    id: "clear",
    family: `'Lexend', ${ARABIC}, sans-serif`,
    weight: 700,
    load: () => import("@fontsource/lexend/700.css"),
  },
  {
    id: "soft",
    family: "'Rubik', sans-serif",
    weight: 700,
    load: () => import("@fontsource/rubik/700.css"),
  },
  {
    id: "slab",
    family: `'Bitter', ${ARABIC}, serif`,
    weight: 700,
    load: () => import("@fontsource/bitter/700.css"),
  },
  {
    id: "classic",
    family: `'IBM Plex Serif', ${ARABIC}, serif`,
    weight: 700,
    load: () => import("@fontsource/ibm-plex-serif/700.css"),
  },
  {
    id: "comic",
    family: `'Comic Neue', ${ARABIC}, cursive`,
    weight: 700,
    load: () => import("@fontsource/comic-neue/700.css"),
  },
  {
    id: "typewriter",
    family: `'Space Mono', ${ARABIC}, monospace`,
    weight: 700,
    load: () => import("@fontsource/space-mono/700.css"),
  },
  {
    id: "code",
    family: `'Fira Code', ${ARABIC}, monospace`,
    weight: 700,
    load: () => import("@fontsource/fira-code/700.css"),
  },
  {
    id: "kufi",
    family: "'Noto Sans Arabic', sans-serif",
    weight: 700,
    load: () => import("@fontsource/noto-sans-arabic/arabic-700.css"),
  },
];

const loadedFonts = new Set<string>();

/** Fetch a name's font once, the first time a name is drawn with it */
function loadNameFont(font: (typeof NAME_FONTS)[number]) {
  if (!font.load || loadedFonts.has(font.id)) return;
  loadedFonts.add(font.id);
  void font.load().catch(() => loadedFonts.delete(font.id));
}

/** Built-in avatar decorations (same ids as the API's allow-list) */
export const DECORATIONS = [
  "laurel",
  "light-crown",
  "rings",
  "ivy",
  "thorn-roses",
  "ice-crystal",
  "flame-ring",
  "lightning",
  "moon-halo",
  "sun-rays",
  "star-orbit",
  "sakura-branch",
  "geometric-hex",
  "neon",
  "wings",
  "feathers",
  "gear",
  "circuit",
  "waves",
  "leaves",
  "snow",
  "hearts",
  "music-notes",
  "shield-frame",
] as const;

/** Ready-made two-colour profile themes */
export const THEME_PRESETS: { id: string; colours: [string, string] }[] = [
  { id: "Sunset", colours: ["#ff6b4a", "#ffb347"] },
  { id: "Ocean", colours: ["#1e9bb8", "#6fd3e8"] },
  { id: "Grape", colours: ["#8b2be2", "#e0218a"] },
  { id: "Mint", colours: ["#11998e", "#38ef7d"] },
  { id: "Midnight", colours: ["#0f2027", "#2c5364"] },
  { id: "Cherry", colours: ["#eb3349", "#f45c43"] },
  { id: "Gold", colours: ["#f7971e", "#ffd200"] },
  { id: "Aurora", colours: ["#00c6ff", "#0072ff"] },
  { id: "Rose", colours: ["#ff9a9e", "#fecfef"] },
  { id: "Forest", colours: ["#134e5e", "#71b280"] },
  { id: "Neon", colours: ["#00f260", "#0575e6"] },
  { id: "Candy", colours: ["#ff758c", "#ff7eb3"] },
];

/** Inline style for a display name in this user's chosen font and colour */
export function nameStyle(
  style: UserStyle | undefined,
  options: { colour?: boolean } = {},
): JSX.CSSProperties {
  if (!style) return {};
  const css: JSX.CSSProperties = {};
  const font = NAME_FONTS.find((f) => f.id === style.name_font);
  if (font && font.id !== "default") {
    loadNameFont(font);
    if (font.family !== "inherit") css["font-family"] = font.family;
    if (font.weight) css["font-weight"] = font.weight;
    Object.assign(css, font.extra);
  }
  const list = colours(style.name_colour);
  if (options.colour !== false && list.length === 1) {
    css.color = list[0];
  } else if (options.colour !== false && list.length === 2) {
    css["background-image"] = `linear-gradient(90deg, ${list[0]}, ${list[1]})`;
    css["-webkit-background-clip"] = "text";
    css["background-clip"] = "text";
    css.color = "transparent";
    css["-webkit-text-fill-color"] = "transparent";
  }
  return css;
}

/** The profile theme colours, if the user picked any */
export function themeColours(style: UserStyle | undefined) {
  const list = colours(style?.theme);
  if (!list.length) return undefined;
  return { top: list[0], bottom: list[1] ?? list[0] };
}

const PLATE_THEMES = [
  "aurora",
  "autumn",
  "sakura",
  "ocean",
  "clouds",
  "sunset",
  "midnight",
  "mint",
];
const PLATE_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];
/** Arab League members: the first group everywhere */
const PLATE_ARAB = [
  "dz",
  "bh",
  "km",
  "dj",
  "eg",
  "iq",
  "jo",
  "kw",
  "lb",
  "ly",
  "mr",
  "ma",
  "om",
  "ps",
  "qa",
  "sa",
  "so",
  "sd",
  "sy",
  "tn",
  "ae",
  "ye",
];
/** UN members and observers, and three home flags people asked for */
const PLATE_WORLD = [
  "ad",
  "af",
  "ag",
  "al",
  "am",
  "ao",
  "ar",
  "at",
  "au",
  "az",
  "ba",
  "bb",
  "bd",
  "be",
  "bf",
  "bg",
  "bi",
  "bj",
  "bn",
  "bo",
  "br",
  "bs",
  "bt",
  "bw",
  "by",
  "bz",
  "ca",
  "cd",
  "cf",
  "cg",
  "ch",
  "ci",
  "cl",
  "cm",
  "cn",
  "co",
  "cr",
  "cu",
  "cv",
  "cy",
  "cz",
  "de",
  "dk",
  "dm",
  "do",
  "ec",
  "ee",
  "er",
  "es",
  "et",
  "fi",
  "fj",
  "fm",
  "fr",
  "ga",
  "gb",
  "gb-eng",
  "gb-sct",
  "gd",
  "ge",
  "gh",
  "gm",
  "gn",
  "gq",
  "gr",
  "gt",
  "gw",
  "gy",
  "hn",
  "hr",
  "ht",
  "hu",
  "id",
  "ie",
  "in",
  "ir",
  "is",
  "it",
  "jm",
  "jp",
  "ke",
  "kg",
  "kh",
  "ki",
  "kn",
  "kp",
  "kr",
  "kurdistan",
  "kz",
  "la",
  "lc",
  "li",
  "lk",
  "lr",
  "ls",
  "lt",
  "lu",
  "lv",
  "mc",
  "md",
  "me",
  "mg",
  "mh",
  "mk",
  "ml",
  "mm",
  "mn",
  "mt",
  "mu",
  "mv",
  "mw",
  "mx",
  "my",
  "mz",
  "na",
  "ne",
  "ng",
  "ni",
  "nl",
  "no",
  "np",
  "nr",
  "nz",
  "pa",
  "pe",
  "pg",
  "ph",
  "pk",
  "pl",
  "pt",
  "pw",
  "py",
  "ro",
  "rs",
  "ru",
  "rw",
  "sb",
  "sc",
  "se",
  "sg",
  "si",
  "sk",
  "sl",
  "sm",
  "sn",
  "sr",
  "ss",
  "st",
  "sv",
  "sz",
  "td",
  "tg",
  "th",
  "tj",
  "tl",
  "tm",
  "to",
  "tr",
  "tt",
  "tv",
  "tz",
  "ua",
  "ug",
  "us",
  "uy",
  "uz",
  "va",
  "vc",
  "ve",
  "vn",
  "vu",
  "ws",
  "za",
  "zm",
  "zw",
];

export type NameplateGroup = "arab" | "flag" | "theme" | "zodiac";

/** Art is a small file, fetched only when a plate is on screen */
const plateFile = (id: string) =>
  `${import.meta.env.BASE_URL}nameplates/${id}.svg`;

/** A plate's art. `#rtl` puts its emblem at the other end, see `decorations.css` */
const plateArt = (id: string) => {
  const url = plateFile(id);
  return `var(--z-plate-ltr, url("${url}")) var(--z-plate-rtl, url("${url}#rtl")) center / 100% 100% no-repeat`;
};

const plateEntry = (id: string, group: NameplateGroup) => ({
  id,
  group,
  background: plateArt(id),
});

/** Built-in nameplates (same ids as the API): backgrounds behind a name */
export const NAMEPLATES: {
  id: string;
  group: NameplateGroup;
  background: string;
}[] = [
  ...PLATE_ARAB.map((id) => plateEntry(`flag-${id}`, "arab")),
  ...PLATE_WORLD.map((id) => plateEntry(`flag-${id}`, "flag")),
  ...PLATE_THEMES.map((id) => plateEntry(id, "theme")),
  ...PLATE_SIGNS.map((id) => plateEntry(`zodiac-${id}`, "zodiac")),
];

/** A plain theme's slow layer, loaded when it starts to move */
export const nameplateDrift = (id: string | undefined) =>
  id && PLATE_THEMES.includes(id)
    ? `${import.meta.env.BASE_URL}nameplates/motion/${id}.svg`
    : undefined;

/**
 * Shape of every nameplate, in every place. Put this `aspect-ratio` on the
 * element that shows one, so the art is seen whole and nothing is cropped.
 */
export const NAMEPLATE_RATIO = "448 / 84";

/** Community items are referenced as `c:<id>` */
export const isCommunityRef = (value: string | undefined) =>
  !!value && value.startsWith("c:");

/** URL of a community image on the media server (animated original) */
export function communityFileUrl(mediaUrl: string, fileId: string | undefined) {
  return fileId && /^[\w-]+$/.test(fileId)
    ? `${mediaUrl}/decorations/${fileId}/original`
    : undefined;
}

/**
 * URL of one still frame of a community image, for anyone who sees no motion
 * and for lists at rest. The media server draws it.
 */
export function communityStillUrl(
  mediaUrl: string,
  fileId: string | undefined,
) {
  return fileId && /^[\w-]+$/.test(fileId)
    ? `${mediaUrl}/decorations/${fileId}`
    : undefined;
}

/** URL of an effect's file: what plays */
export function effectFileUrl(mediaUrl: string, fileId: string | undefined) {
  return fileId && /^[\w-]+$/.test(fileId)
    ? `${mediaUrl}/effects/${fileId}/original`
    : undefined;
}

/** URL of one still frame of an effect, drawn by the media server for tiles */
export function effectStillUrl(mediaUrl: string, fileId: string | undefined) {
  return fileId && /^[\w-]+$/.test(fileId)
    ? `${mediaUrl}/effects/${fileId}`
    : undefined;
}

/**
 * The nameplate's art, for `--plate` on a `.z-plate` element, or undefined. Community nameplates are images; built-in ones are our own SVGs.
 * A community image is a still unless `moving` is set, which a caller does only
 * when this viewer sees motion: on hover in a list, always in a preview.
 */
export function nameplateBackground(
  style: UserStyle | undefined,
  mediaUrl: string,
  options: { moving?: boolean } = {},
): string | undefined {
  const id = style?.nameplate;
  if (!id) return;
  let art: string | undefined;
  if (isCommunityRef(id)) {
    const file = style?.nameplate_file;
    const url = options.moving
      ? communityFileUrl(mediaUrl, file)
      : communityStillUrl(mediaUrl, file);
    art = url ? `url("${url}") center / 100% 100% no-repeat` : undefined;
  } else {
    art = NAMEPLATES.find((n) => n.id === id)?.background;
  }
  return art;
}
