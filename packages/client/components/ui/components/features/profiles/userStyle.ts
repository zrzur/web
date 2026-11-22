import { type JSX, createSignal } from "solid-js";

import { isEffectId } from "./effects/effectIds";
import "./nameEffects.css";
import {
  PACK_DECORATIONS,
  PACK_NAMEPLATES,
  PACK_PLATE_DRIFT,
} from "./pack/designs.generated";

/**
 * A user's chosen look, as stored by the API on the user object
 * (`style`). The server only accepts the ids and `#rrggbb` colours below,
 * so these values are safe to put into inline styles.
 */
export type UserStyle = {
  theme?: string[];
  name_font?: string;
  name_colour?: string[];
  /** one of `NAME_EFFECTS`, drawn on top of the colour */
  name_effect?: string;
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
  const { decoration, nameplate, effect } = style;
  const staleDecoration =
    decoration &&
    !isCommunityRef(decoration) &&
    !(DECORATIONS as readonly string[]).includes(decoration);
  const stalePlate =
    nameplate &&
    !isCommunityRef(nameplate) &&
    !NAMEPLATES.some((plate) => plate.id === nameplate);
  const staleEffect = effect && !isCommunityRef(effect) && !isEffectId(effect);
  if (!staleDecoration && !stalePlate && !staleEffect) return style;
  const rest = { ...style };
  if (staleDecoration) {
    delete rest.decoration;
    delete rest.decoration_file;
  }
  if (stalePlate) {
    delete rest.nameplate;
    delete rest.nameplate_file;
  }
  if (staleEffect) {
    delete rest.effect;
    delete rest.effect_file;
  }
  return rest;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const colours = (list: unknown, most = 2) =>
  Array.isArray(list) ? list.filter((c) => HEX.test(c)).slice(0, most) : [];

/** Effects a display name can wear (same ids as the API's allow-list) */
export const NAME_EFFECTS = ["halo", "edge", "lifted", "sheen"] as const;
export type NameEffect = (typeof NAME_EFFECTS)[number];

/** Most colours in a name: three to five make a spectrum */
export const NAME_MAX_COLOURS = 5;

/** How this viewer sees names, kept in step by `useNameStyleSync` */
const [nameView, setNameView] = createSignal({
  /** "Show name styles" is off: every name is plain */
  plain: false,
  /** light surfaces: colours are darkened until they read */
  light: false,
  /** reduced motion or no motion: nothing moves */
  still: false,
});
export { setNameView };

const rgb = (hex: string) =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const luminance = (channels: number[]) => {
  const [r, g, b] = channels.map((value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const toHex = (channels: number[]) =>
  "#" +
  channels
    .map((v) => Math.round(Math.max(0, v)).toString(16).padStart(2, "0"))
    .join("");

/**
 * A name colour for light surfaces: the same hue, darkened step by step until
 * it reads at 4.5:1 on the darkest light surface (the rail, #E4E6F0), so it
 * reads on every lighter one too. Dark colours stay as they are.
 */
export function nameColourForLight(hex: string) {
  const base = rgb(hex);
  const rail = luminance(rgb("#E4E6F0")) + 0.05;
  const reads = (c: number[]) => rail / (luminance(c) + 0.05) >= 4.5;
  for (let k = 1; k > 0; k -= 0.02) {
    // judge the rounded colour that will be drawn, not the exact one
    const shade = toHex(base.map((v) => v * k));
    if (reads(rgb(shade))) return shade;
  }
  return "#000000";
}

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
    family: `'JetBrains Mono', ${ARABIC}, monospace`,
    weight: 700,
    load: () => import("@fontsource/jetbrains-mono/700.css"),
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

/** Zrzur's first decorations */
const BASE_DECORATIONS = [
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

/** Built-in avatar decorations (same ids as the API's allow-list) */
export const DECORATIONS = [...BASE_DECORATIONS, ...PACK_DECORATIONS] as const;

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

/**
 * Inline style for a display name in this user's chosen font, colours and
 * effect.
 *
 * - `colour: false` keeps someone else's colour (a server role): the font and
 *   the effects that need no colour of their own (halo, edge, lifted) stay.
 * - `moving` lets a spectrum flow and a sheen pass. Only single places ask for
 *   it (a profile, the editor); lists stay on one still frame, so a member
 *   list costs nothing to keep.
 * - `surface` and `always` are for previews: draw for that surface, and
 *   ignore the viewer's "Show name styles" switch.
 */
export function nameStyle(
  style: UserStyle | undefined,
  options: {
    colour?: boolean;
    moving?: boolean;
    surface?: "light" | "dark";
    always?: boolean;
  } = {},
): JSX.CSSProperties {
  if (!style) return {};
  const view = nameView();
  if (view.plain && !options.always) return {};
  const css: JSX.CSSProperties = {};
  const font = NAME_FONTS.find((f) => f.id === style.name_font);
  if (font && font.id !== "default") {
    loadNameFont(font);
    if (font.family !== "inherit") css["font-family"] = font.family;
    if (font.weight) css["font-weight"] = font.weight;
    Object.assign(css, font.extra);
  }

  const light = options.surface ? options.surface === "light" : view.light;
  const moving = options.moving && !view.still;
  const own = options.colour !== false;
  const list = own
    ? colours(style.name_colour, NAME_MAX_COLOURS).map((c) =>
        light ? nameColourForLight(c) : c,
      )
    : [];
  const effect = (NAME_EFFECTS as readonly string[]).includes(
    style.name_effect ?? "",
  )
    ? (style.name_effect as NameEffect)
    : undefined;

  const clip = (image: string) => {
    css["background-image"] = image;
    css["-webkit-background-clip"] = "text";
    css["background-clip"] = "text";
    css.color = "transparent";
    css["-webkit-text-fill-color"] = "transparent";
  };

  // the fill
  let clipped = false;
  if (effect === "edge" && list.length) {
    // edge: first colour fills, the second draws the border
    css.color = list[0];
  } else if (effect === "sheen" && list.length) {
    const [a, b = list[0]] = list;
    clip(
      `linear-gradient(100deg, ${a} 0 42%, ${light ? "#ffffff" : "color-mix(in srgb, " + a + " 30%, #fff)"} 50%, ${b} 58% 100%)`,
    );
    css["background-size"] = "250% 100%";
    css["background-position"] = moving ? undefined : "55% 0";
    if (moving) css.animation = "z-name-sheen 5s ease-in-out infinite";
    clipped = true;
  } else if (list.length === 1) {
    css.color = list[0];
  } else if (list.length === 2) {
    clip(`linear-gradient(90deg, ${list[0]}, ${list[1]})`);
    clipped = true;
  } else if (list.length >= 3) {
    // spectrum: the colours run round once, so the flow has no seam
    clip(`linear-gradient(90deg, ${[...list, list[0]].join(", ")})`);
    css["background-size"] = "200% 100%";
    css["background-position"] = moving ? undefined : "30% 0";
    if (moving) css.animation = "z-name-flow 9s linear infinite";
    clipped = true;
  }

  // the effect on top; a clipped or borrowed fill takes it as a filter
  const glow = own ? (list[0] ?? "currentColor") : "currentColor";
  const asFilter = clipped || !own;
  if (effect === "halo") {
    const near = `color-mix(in srgb, ${glow} ${light ? 55 : 70}%, transparent)`;
    const far = `color-mix(in srgb, ${glow} ${light ? 25 : 40}%, transparent)`;
    if (asFilter)
      css.filter = `drop-shadow(0 0 4px ${near}) drop-shadow(0 0 10px ${far})`;
    else css["text-shadow"] = `0 0 6px ${near}, 0 0 14px ${far}`;
  } else if (effect === "edge") {
    const ring = list[1] ?? `color-mix(in srgb, ${glow} 40%, #000)`;
    const steps = [
      [1.5, 0],
      [-1.5, 0],
      [0, 1.5],
      [0, -1.5],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ];
    if (asFilter)
      css.filter = steps
        .slice(0, 4)
        .map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${ring})`)
        .join(" ");
    else
      css["text-shadow"] = steps
        .map(([x, y]) => `${x}px ${y}px 0 ${ring}`)
        .join(", ");
  } else if (effect === "lifted") {
    const under = `color-mix(in srgb, ${glow} 45%, #000)`;
    const shade = light ? "rgb(23 25 37 / 0.28)" : "rgb(0 0 0 / 0.55)";
    if (asFilter)
      css.filter = `drop-shadow(0 2px 0 ${under}) drop-shadow(0 3px 3px ${shade})`;
    else
      css["text-shadow"] =
        `0 1px 0 ${under}, 0 2px 0 ${under}, 0 4px 6px ${shade}`;
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

/**
 * A plate's art. `#rtl` puts its emblem at the other end, see `decorations.css`.
 * The right-to-left copy has its own address (?rtl): browsers keep one copy of
 * an SVG image per address and ignore the fragment, so `#rtl` alone could show
 * the copy already loaded for left-to-right.
 */
const plateArt = (id: string) => {
  const url = plateFile(id);
  return `var(--z-plate-ltr, url("${url}")) var(--z-plate-rtl, url("${url}?rtl#rtl")) center / 100% 100% no-repeat`;
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
  ...PACK_NAMEPLATES.map((id) => plateEntry(id, "theme")),
];

const DRIFTING = new Set<string>([...PLATE_THEMES, ...PACK_PLATE_DRIFT]);

/** A plain theme's slow layer, loaded when it starts to move */
export const nameplateDrift = (id: string | undefined) =>
  id && DRIFTING.has(id)
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
 * The address a community design is shown from in a gallery or a card: its
 * file as uploaded (it may move), or, for a viewer who is saving data, the
 * one still frame the media server draws (some twenty kilobytes instead of
 * up to a megabyte).
 */
export function communityShownUrl(
  mediaUrl: string,
  kind: string,
  fileId: string | undefined,
  saving: boolean,
) {
  if (kind === "Effect")
    return saving
      ? effectStillUrl(mediaUrl, fileId)
      : effectFileUrl(mediaUrl, fileId);
  return saving
    ? communityStillUrl(mediaUrl, fileId)
    : communityFileUrl(mediaUrl, fileId);
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
