import { type JSX, createSignal } from "solid-js";

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
  /** `c:<id>` of a community decoration */
  decoration?: string;
  /** image of a community decoration (filled in by the server) */
  decoration_file?: string;
  /** `c:<id>` of a community nameplate */
  nameplate?: string;
  /** image of a community nameplate (filled in by the server) */
  nameplate_file?: string;
  /** `c:<id>` of a community effect */
  effect?: string;
  /** file of a community effect (filled in by the server) */
  effect_file?: string;
  /** frame around the whole profile card: `c:<id>` of a community frame */
  profile_frame?: string;
  /** image of a community frame (filled in by the server) */
  profile_frame_file?: string;
};

/** Read the style the API attached to a user (absent on older servers) */
export function userStyleOf(user: unknown): UserStyle | undefined {
  const style = (user as { style?: UserStyle } | undefined)?.style;
  if (!style || typeof style !== "object") return undefined;
  // Every design is a community one (`c:<id>`). Anything else is a design
  // Zrzur no longer ships (the built-in ones were removed on 2026-11-26):
  // it counts as none, so it draws nothing and saving still works.
  const { decoration, nameplate, effect, profile_frame } = style;
  const stale = (value: string | undefined) =>
    !!value && !isCommunityRef(value);
  const staleDecoration = stale(decoration);
  const stalePlate = stale(nameplate);
  const staleEffect = stale(effect);
  const staleFrame = stale(profile_frame);
  if (!staleDecoration && !stalePlate && !staleEffect && !staleFrame)
    return style;
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
  if (staleFrame) {
    delete rest.profile_frame;
    delete rest.profile_frame_file;
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

/**
 * The bright band a sheen passes over the letters. On dark surfaces it is the
 * colour mixed with white. On light surfaces white would make the letters
 * vanish, so it is the lightest tint of the colour that still reads at 4.5:1
 * (the same rule as `nameColourForLight`).
 */
export function sheenHighlight(hex: string, light: boolean) {
  if (!light) return `color-mix(in srgb, ${hex} 30%, #fff)`;
  const tint = toHex(rgb(hex).map((v) => v + (255 - v) * 0.5));
  return nameColourForLight(tint);
}

/**
 * The keyframes of the names that move (a flowing spectrum, a passing sheen),
 * loaded the first time one moves: lists never ask for motion, so most
 * people never download them.
 */
let nameMotion: Promise<unknown> | undefined;
const loadNameMotion = () => (nameMotion ??= import("./nameEffects.css"));

/** Keeps Arabic in Zrzur's own face when a font has no Arabic of its own */
const ARABIC = "'IBM Plex Sans Arabic'";

/**
 * Display-name fonts: what ships with the system, and open fonts already in
 * the app (all SIL OFL 1.1, `@fontsource/*` in THIRD-PARTY-LICENSES.md), each
 * loaded the first time a name uses it.
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
  const chosen = own ? colours(style.name_colour, NAME_MAX_COLOURS) : [];
  const list = light ? chosen.map(nameColourForLight) : chosen;
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
      `linear-gradient(100deg, ${a} 0 42%, ${sheenHighlight(a, light)} 50%, ${b} 58% 100%)`,
    );
    css["background-size"] = "250% 100%";
    css["background-position"] = moving ? undefined : "55% 0";
    if (moving) {
      void loadNameMotion();
      css.animation = "z-name-sheen 5s ease-in-out infinite";
    }
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
    if (moving) {
      void loadNameMotion();
      css.animation = "z-name-flow 9s linear infinite";
    }
    clipped = true;
  }

  // the effect on top; a clipped or borrowed fill takes it as a filter
  const glow = own ? (list[0] ?? "currentColor") : "currentColor";
  // a halo is light: on a light surface it comes from the bright colour as
  // chosen, not the darkened letters (a dark blur looks smudged there)
  const shine = own ? (chosen[0] ?? "currentColor") : "currentColor";
  const asFilter = clipped || !own;
  if (effect === "halo") {
    const near = `color-mix(in srgb, ${shine} ${light ? 60 : 70}%, transparent)`;
    const far = `color-mix(in srgb, ${shine} ${light ? 30 : 40}%, transparent)`;
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

/**
 * Whether this viewer sees the person's own chosen name colour: they chose
 * one, and "Show name styles" is on. Where it is true, it wins over a server
 * role colour (see `Username`).
 */
export function hasOwnNameColour(style: UserStyle | undefined) {
  return (
    !!style &&
    !nameView().plain &&
    colours(style.name_colour, NAME_MAX_COLOURS).length > 0
  );
}

/** The profile theme colours, if the user picked any */
export function themeColours(style: UserStyle | undefined) {
  const list = colours(style?.theme);
  if (!list.length) return undefined;
  return { top: list[0], bottom: list[1] ?? list[0] };
}

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
  const local = localDesignUrl(fileId);
  if (local) return local;
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
  const local = localDesignUrl(fileId);
  if (local) return local;
  return fileId && /^[\w-]+$/.test(fileId)
    ? `${mediaUrl}/decorations/${fileId}`
    : undefined;
}

/**
 * The nameplate's art, for `--plate` on a `.z-plate` element, or undefined.
 * Every nameplate is a community image: a still unless `moving` is set, which
 * a caller does only when this viewer sees motion: on hover in a list, always
 * in a preview.
 */
export function nameplateBackground(
  style: UserStyle | undefined,
  mediaUrl: string,
  options: { moving?: boolean; rowHeight?: number } = {},
): string | undefined {
  const id = style?.nameplate;
  if (!isCommunityRef(id)) return;
  const file = style?.nameplate_file;
  const url = options.moving
    ? communityFileUrl(mediaUrl, file)
    : communityStillUrl(mediaUrl, file);
  if (!url) return undefined;
  // the drawing itself fills the box: an empty margin around it is left out
  const drawn = file ? plateDrawn(file, communityStillUrl(mediaUrl, file)!) : undefined;
  // a member row waits for the measure (a moment) rather than jump into place
  if (options.rowHeight && file && drawn === undefined) return undefined;
  const fit = drawn
    ? options.rowHeight
      ? fitRow(drawn.width, drawn.height, drawn.box, options.rowHeight)
      : fitDrawing(drawn.width, drawn.height, drawn.box)
    : undefined;
  return fit
    ? `url("${url}") ${fit.position} / ${fit.size} no-repeat`
    : `url("${url}") center / 100% 100% no-repeat`;
}

/**
 * A nameplate in a member row, as Discord shows one: never stretched out of
 * shape. The drawing is scaled to the row's height, keeping its proportions,
 * and held to the row's end (right, the emblem's side); whatever is left over
 * at the start runs under the avatar, where the mask fades it out anyway.
 */
export function fitRow(
  width: number,
  height: number,
  box: { minX: number; minY: number; maxX: number; maxY: number },
  rowHeight: number,
): PlateFit {
  const drawnH = box.maxY - box.minY + 1;
  const scale = rowHeight / drawnH;
  const px = (n: number) => `${Math.round(n * 100) / 100}px`;
  return {
    size: `${px(width * scale)} ${px(height * scale)}`,
    // held to the row's end: the drawing's right edge on the row's right, or
    // in right-to-left languages its left edge on the row's left
    // (--z-plate-ltr is 1 or 0, set with the page's direction)
    position: `calc(var(--z-plate-ltr, 1) * (100% + ${px((width - 1 - box.maxX) * scale)}) - (1 - var(--z-plate-ltr, 1)) * ${px(box.minX * scale)}) ${px(-box.minY * scale)}`,
  };
}

/** Where a nameplate's drawing sits in its image: size and position for CSS */
export type PlateFit = { size: string; position: string };

/**
 * The background size and position that stretch the drawn part of an image
 * (the box `minX..maxX`, `minY..maxY` of its pixels, in a `width` x `height`
 * image) to the whole element. Undefined when the drawing already fills it.
 * Percent positions do not depend on the element's size: the same fit holds
 * in the member list, a card or a preview.
 */
export function fitDrawing(
  width: number,
  height: number,
  box: { minX: number; minY: number; maxX: number; maxY: number },
): PlateFit | undefined {
  const drawnW = box.maxX - box.minX + 1;
  const drawnH = box.maxY - box.minY + 1;
  if (drawnW <= 0 || drawnH <= 0) return undefined;
  // a margin under 2 percent is not worth stretching for
  if (drawnW >= width * 0.98 && drawnH >= height * 0.98) return undefined;
  const at = (start: number, drawn: number, whole: number) =>
    drawn >= whole ? 50 : (start / (whole - drawn)) * 100;
  const pct = (n: number) => `${Math.round(n * 1000) / 1000}%`;
  return {
    size: `${pct((width / drawnW) * 100)} ${pct((height / drawnH) * 100)}`,
    position: `${pct(at(box.minX, drawnW, width))} ${pct(at(box.minY, drawnH, height))}`,
  };
}

/** The box of an image's visible pixels (alpha above a faint trace) */
export function drawnBox(data: Uint8ClampedArray, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? undefined : { minX, minY, maxX, maxY };
}

/** A nameplate image measured: its size and the box of its drawing */
export type PlateDrawn = {
  width: number;
  height: number;
  box: { minX: number; minY: number; maxX: number; maxY: number };
};

/** Images measured so far, by file: null when they can't be read */
const [plateDrawns, setPlateDrawns] = createSignal(
  new Map<string, PlateDrawn | null>(),
);
const measuring = new Set<string>();
const loading = new Map<string, HTMLImageElement>();

/**
 * Where a nameplate's drawing sits in its image, once measured (reactive: a
 * caller in a memo or JSX updates when it arrives). Measured once per file,
 * from its still, on a canvas; until then, and if the image can't be read,
 * the art is stretched whole as before.
 */
export function plateDrawn(file: string, stillUrl: string): PlateDrawn | null | undefined {
  // undefined: being measured; null: can't be read (the art is shown whole)
  const known = plateDrawns().get(file);
  if (known !== undefined) return known;
  if (measuring.has(file) || typeof document === "undefined") return undefined;
  measuring.add(file);
  const img = new Image();
  // held until it answers: an image nothing refers to may be collected
  // before it loads, and then it never answers at all
  loading.set(file, img);
  let answered = false;
  const done = (drawn: PlateDrawn | null) => {
    if (answered) return;
    answered = true;
    loading.delete(file);
    setPlateDrawns((all) => new Map(all).set(file, drawn));
  };
  // a plate is never held back for long: after 4 s it shows whole
  setTimeout(() => done(null), 4000);
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || !canvas.width || !canvas.height) return done(null);
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const box = drawnBox(pixels, canvas.width, canvas.height);
      done(box ? { width: canvas.width, height: canvas.height, box } : null);
    } catch {
      done(null);
    }
  };
  img.onerror = () => done(null);
  img.src = stillUrl;
  return undefined;
}

/**
 * Designs being made in the Creator Studio: files not uploaded yet, by a
 * made-up file id, so the app's own parts (the profile card, the member
 * list) can wear them in a preview exactly as they will look
 */
const localDesigns = new Map<string, string>();
let localCount = 0;

/** Lend a picked file to the app's parts: the id to put in a style */
export function lendLocalDesign(url: string) {
  const id = `local-${++localCount}`;
  localDesigns.set(id, url);
  return { id, release: () => localDesigns.delete(id) };
}

/** The address of a lent file, if this id is one */
export const localDesignUrl = (fileId: string | undefined) =>
  fileId ? localDesigns.get(fileId) : undefined;
