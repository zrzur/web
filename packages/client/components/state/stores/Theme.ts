import { Accessor, createSignal } from "solid-js";

import {
  FONT_KEYS,
  Fonts,
  MONOSPACE_FONT_KEYS,
  MonospaceFonts,
} from "@revolt/ui/themes/fonts";

import { State } from "..";

import {
  ThemeSnapshot,
  themeSnapshotSchema,
} from "@revolt/ui/themes/savedThemes";
import {
  RETIRED_DEFAULTS,
  ZRZUR_UNIFIED_DARK,
} from "@revolt/ui/themes/zrzurTheme";
import { AbstractStore } from ".";

export type TypeTheme = {
  /**
   * Base theme preset
   */
  preset: "you" | "zrzur";

  /**
   * Light/dark mode
   */
  mode: "light" | "dark" | "system";

  /**
   * Accent
   * (Material You / Zrzur)
   */
  m3Accent: string;

  /**
   * Constrast
   * (Material You)
   */
  m3Contrast: number;

  /**
   * Variant
   * (Material You)
   */
  m3Variant:
    | "monochrome"
    | "neutral"
    | "tonal_spot"
    | "vibrant"
    | "expressive"
    | "fidelity"
    | "content"
    | "rainbow"
    | "fruit_salad";

  /**
   * Colour engine: zrzur (default) or legacy material-you
   */
  colourEngine: "zrzur" | "material-you";

  /**
   * Optional chrome icon tint. Empty / brand violet → muted outline chrome.
   */
  iconAccent: string;

  /**
   * Icon line weight. Product locks Outline (Kontur); filled/expressive kept
   * for stored snapshots and rare styleVariant overrides.
   */
  iconStyle: "outline" | "filled" | "expressive";

  /**
   * Icon pixel size
   */
  iconSize: number;

  /**
   * Expressive fill opacity 0–1
   */
  iconFill: number;

  /**
   * Subtle glow strength 0–1
   */
  iconGlow: number;

  /**
   * Corner radius in px
   */
  radius: number;

  /**
   * Server rail width
   */
  railWidth: number;

  /**
   * Channel sidebar width
   */
  sidebarWidth: number;

  /**
   * UI density
   */
  density: "compact" | "comfortable" | "spacious";

  /**
   * Active curated Appearance Studio preset id
   */
  appearancePreset: string;

  /**
   * Optional surface overrides from Appearance Studio presets
   */
  surfaces?: {
    bgApp?: string;
    bgRail?: string;
    bgSidebar?: string;
    bgChat?: string;
    bgRaised?: string;
  };

  /**
   * Whether to permit blurry surfaces
   */
  blur: boolean;

  /**
   * Interface font
   */
  interfaceFont: Fonts;

  /**
   * Monospace font
   */
  monospaceFont: MonospaceFonts;

  /**
   * Message size
   */
  messageSize: number;

  /**
   * Spacing between message groups
   */
  messageGroupSpacing: number;
};

export type SelectedTheme = Pick<
  TypeTheme,
  | "blur"
  | "interfaceFont"
  | "monospaceFont"
  | "messageSize"
  | "messageGroupSpacing"
  | "colourEngine"
  | "iconAccent"
  | "iconStyle"
  | "iconSize"
  | "iconFill"
  | "iconGlow"
  | "radius"
  | "railWidth"
  | "sidebarWidth"
  | "density"
  | "appearancePreset"
  | "surfaces"
> & {
  preset: "you" | "zrzur";
  darkMode: boolean;

  accent: string;
  contrast: number;
  variant: TypeTheme["m3Variant"];
};

/**
 * Manages theme information
 */
export class Theme extends AbstractStore<"theme", TypeTheme> {
  exportSnapshot(): ThemeSnapshot {
    const {
      mode,
      m3Accent,
      iconAccent,
      iconStyle,
      iconSize,
      iconFill,
      radius,
      railWidth,
      sidebarWidth,
      density,
      blur,
      interfaceFont,
      monospaceFont,
      messageSize,
      messageGroupSpacing,
      surfaces,
    } = this.get();
    return themeSnapshotSchema.parse({
      mode,
      m3Accent,
      iconAccent,
      iconStyle,
      iconSize,
      iconFill,
      radius,
      railWidth,
      sidebarWidth,
      density,
      blur,
      interfaceFont,
      monospaceFont,
      messageSize,
      messageGroupSpacing,
      surfaces,
    });
  }

  applySnapshot(input: ThemeSnapshot) {
    const validated = themeSnapshotSchema.parse(input);
    this.set(
      this.clean({
        ...this.get(),
        ...validated,
        preset: "zrzur",
        colourEngine: "zrzur",
        appearancePreset: "custom",
      }),
    );
  }

  prefersDark: Accessor<boolean>;

  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "theme");

    // handle prefers-color-scheme value and changes
    const [prefersDark, setPrefersDark] = createSignal(
      window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches,
    );

    this.prefersDark = prefersDark;

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => setPrefersDark(event.matches));

    this.toggleBlur = this.toggleBlur.bind(this);
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    /** nothing needs to be done */
  }

  /**
   * Generate default values
   */
  default(): TypeTheme {
    return {
      preset: "zrzur",
      mode: "dark",

      m3Accent: ZRZUR_UNIFIED_DARK.accentDefault,
      m3Contrast: 0.0,
      m3Variant: "tonal_spot",

      colourEngine: "zrzur",
      iconAccent: ZRZUR_UNIFIED_DARK.iconDefault,
      iconStyle: "outline",
      iconSize: 20,
      iconFill: 0.22,
      iconGlow: 0,
      radius: 10,
      railWidth: 72,
      sidebarWidth: 260,
      density: "comfortable",
      appearancePreset: "signature-dark",
      surfaces: {
        bgApp: ZRZUR_UNIFIED_DARK.bgApp,
        bgRail: ZRZUR_UNIFIED_DARK.bgRail,
        bgSidebar: ZRZUR_UNIFIED_DARK.bgSidebar,
        bgChat: ZRZUR_UNIFIED_DARK.bgChat,
        bgRaised: ZRZUR_UNIFIED_DARK.bgRaised,
      },

      interfaceFont: "IBM Plex Sans Variable",
      monospaceFont: "IBM Plex Mono",

      blur: true,
      messageSize: 16,
      messageGroupSpacing: 12,
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeTheme>): TypeTheme {
    const data: TypeTheme = this.default();

    if (["light", "dark", "system"].includes(input.mode!)) {
      data.mode = input.mode!;
    }

    // Dual-read legacy saved theme id `zarzour`, then write only `zrzur`.
    const presetRaw = input.preset as string | undefined;
    const engineRaw = input.colourEngine as string | undefined;
    if (presetRaw === "zarzour") input.preset = "zrzur";
    if (engineRaw === "zarzour") input.colourEngine = "zrzur";
    if (["you", "neutral", "zrzur"].includes(input.preset!)) {
      data.preset = input.preset! as TypeTheme["preset"];
    }

    if (["zrzur", "material-you"].includes(input.colourEngine!)) {
      data.colourEngine = input.colourEngine!;
    }

    // Product icons are Outline (Kontur) only
    data.iconStyle = "outline";

    if (["compact", "comfortable", "spacious"].includes(input.density!)) {
      data.density = input.density!;
    }

    if (typeof input.m3Contrast === "number") {
      data.m3Contrast = input.m3Contrast;
    }

    if (
      input.m3Accent &&
      input.m3Accent.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/)
    ) {
      data.m3Accent = input.m3Accent;
    }

    if (
      input.iconAccent &&
      input.iconAccent.match(
        /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/,
      )
    ) {
      data.iconAccent = input.iconAccent;
    } else if (input.iconAccent === "") {
      // empty = follow the main accent (resolved in activeTheme)
      data.iconAccent = "";
    }

    for (const key of [
      "iconSize",
      "iconFill",
      "iconGlow",
      "radius",
      "railWidth",
      "sidebarWidth",
    ] as const) {
      if (typeof input[key] === "number") {
        data[key] = input[key]!;
      }
    }

    if (
      [
        "monochrome",
        "neutral",
        "tonal_spot",
        "vibrant",
        "expressive",
        "fidelity",
        "content",
        "rainbow",
        "fruit_salad",
      ].includes(input.m3Variant!)
    ) {
      data.m3Variant = input.m3Variant!;
    }

    if (typeof input.blur === "boolean") {
      data.blur = input.blur;
    }

    if (typeof input.messageSize === "number") {
      data.messageSize = input.messageSize;
    }

    if (typeof input.messageGroupSpacing === "number") {
      data.messageGroupSpacing = input.messageGroupSpacing;
    }

    if (
      typeof input.monospaceFont === "string" &&
      MONOSPACE_FONT_KEYS.includes(input.monospaceFont)
    ) {
      data.monospaceFont = input.monospaceFont;
    }

    if (
      typeof input.interfaceFont === "string" &&
      FONT_KEYS.includes(input.interfaceFont)
    ) {
      data.interfaceFont = input.interfaceFont;
    }

    if (typeof input.appearancePreset === "string") {
      data.appearancePreset = input.appearancePreset;
    }

    if (input.surfaces && typeof input.surfaces === "object") {
      const next = { ...data.surfaces };
      for (const key of [
        "bgApp",
        "bgRail",
        "bgSidebar",
        "bgChat",
        "bgRaised",
      ] as const) {
        const value = input.surfaces[key];
        if (
          typeof value === "string" &&
          value.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/)
        ) {
          next![key] = value;
        }
      }
      data.surfaces = next;
    }

    // still on an earlier default palette? move to the current one
    // (anything the user actually customised is left alone)
    const same = (a?: string, b?: string) =>
      !!a && !!b && a.toLowerCase() === b.toLowerCase();
    const surfaceKeys = [
      "bgApp",
      "bgRail",
      "bgSidebar",
      "bgChat",
      "bgRaised",
    ] as const;
    for (const retired of RETIRED_DEFAULTS) {
      const accents: readonly string[] = retired.accents;
      if (accents.some((accent) => same(data.m3Accent, accent))) {
        data.m3Accent = ZRZUR_UNIFIED_DARK.accentDefault;
      }
      const icons: readonly string[] = retired.icons ?? [];
      if (
        accents.some((accent) => same(data.iconAccent, accent)) ||
        icons.some((icon) => same(data.iconAccent, icon))
      ) {
        data.iconAccent = ZRZUR_UNIFIED_DARK.iconDefault;
      }
      if (
        // the rail is left out: a layout option keeps it flush with bgApp
        surfaceKeys
          .filter((key) => key !== "bgRail")
          .every((key) => same(data.surfaces?.[key], retired.surfaces[key]))
      ) {
        data.surfaces = this.default().surfaces;
      }
    }

    // a short-lived build switched untouched default themes to Plus Jakarta
    // Sans automatically; put those on the default. Any other saved font is
    // treated as the user's choice: nothing tells it from an earlier default
    if (
      data.interfaceFont === "Plus Jakarta Sans Variable" &&
      data.appearancePreset === "signature-dark" &&
      surfaceKeys.every((key) =>
        same(data.surfaces?.[key], this.default().surfaces?.[key]),
      )
    ) {
      data.interfaceFont = this.default().interfaceFont;
    }

    return data;
  }

  /**
   * Get the currently selected theme (considering system settings)
   */
  get activeTheme(): SelectedTheme {
    const opts = this.get();
    const darkMode =
      opts.mode === "dark" || (opts.mode === "system" && this.prefersDark());

    return {
      blur: opts.blur,
      interfaceFont: opts.interfaceFont,
      monospaceFont: opts.monospaceFont,
      messageSize: opts.messageSize,
      messageGroupSpacing: opts.messageGroupSpacing,
      colourEngine: opts.colourEngine ?? "zrzur",
      // following the accent (the default pink keeps the default icon colour)
      iconAccent:
        opts.iconAccent ||
        (opts.m3Accent?.toLowerCase() ===
        ZRZUR_UNIFIED_DARK.accentDefault.toLowerCase()
          ? ZRZUR_UNIFIED_DARK.iconDefault
          : opts.m3Accent),
      iconStyle: "outline",
      iconSize: opts.iconSize ?? 20,
      iconFill: opts.iconFill ?? 0.22,
      iconGlow: opts.iconGlow ?? 0,
      radius: opts.radius ?? 10,
      railWidth: opts.railWidth ?? 72,
      sidebarWidth: opts.sidebarWidth ?? 260,
      density: opts.density ?? "comfortable",
      appearancePreset: opts.appearancePreset ?? "signature-dark",
      surfaces: opts.surfaces,
      preset: opts.preset === "you" ? "you" : "zrzur",
      darkMode,
      accent: opts.m3Accent,
      contrast: opts.m3Contrast,
      variant: opts.m3Variant,
    };
  }

  /**
   * Get light/dark/system mode
   */
  get mode() {
    return this.get().mode;
  }

  /**
   * Set light/dark/system mode
   * @param mode Mode
   */
  setMode(mode: TypeTheme["mode"]) {
    this.set("mode", mode);
  }

  /**
   * Get current preset
   */
  get preset() {
    return this.get().preset;
  }

  /**
   * Set the active preset
   * @param preset Preset
   */
  setPreset(preset: TypeTheme["preset"]) {
    this.set("preset", preset);
  }

  /**
   * Get current accent
   */
  get m3Accent() {
    return this.get().m3Accent;
  }

  /**
   * Set the accent of the Material You theme
   * @param accent Accent
   */
  setM3Accent(accent: string) {
    this.set("m3Accent", accent);
  }

  /**
   * Get current contrast
   */
  get m3Contrast() {
    return this.get().m3Contrast;
  }

  /**
   * Set the contrast of the Material You theme
   * @param contrast Contrast
   */
  setM3Contrast(contrast: number) {
    this.set("m3Contrast", contrast);
  }

  /**
   * Get current variant
   */
  get m3Variant() {
    return this.get().m3Variant;
  }

  /**
   * Set the variant of the Material You theme
   * @param variant Variant
   */
  setM3Variant(variant: TypeTheme["m3Variant"]) {
    this.set("m3Variant", variant);
  }

  /**
   * Get current blur state
   */
  get blur() {
    return this.get().blur;
  }

  /**
   * Toggle blur state
   */
  toggleBlur() {
    this.set("blur", !this.blur);
  }

  /**
   * Get current interface font
   */
  get interfaceFont() {
    return this.get().interfaceFont;
  }

  /**
   * Set interface font
   */
  setInterfaceFont(font: Fonts) {
    return this.set("interfaceFont", font);
  }

  /**
   * Get current monospace font
   */
  get monospaceFont() {
    return this.get().monospaceFont;
  }

  /**
   * Set monospace font
   */
  setMonospaceFont(font: MonospaceFonts) {
    return this.set("monospaceFont", font);
  }

  /**
   * Get current message size
   */
  get messageSize() {
    return this.get().messageSize;
  }

  /**
   * Set message size
   */
  set messageSize(size: number) {
    this.set("messageSize", size);
  }

  /**
   * Get current message group spacing
   */
  get messageGroupSpacing() {
    return this.get().messageGroupSpacing;
  }

  /**
   * Set message group spacing
   */
  set messageGroupSpacing(space: number) {
    this.set("messageGroupSpacing", space);
  }

  get iconStyle() {
    return this.get().iconStyle;
  }

  setIconStyle(style: TypeTheme["iconStyle"]) {
    this.set("iconStyle", style);
  }

  get iconAccent() {
    return this.get().iconAccent;
  }

  setIconAccent(accent: string) {
    this.set("iconAccent", accent);
  }

  get colourEngine() {
    return this.get().colourEngine;
  }

  setColourEngine(engine: TypeTheme["colourEngine"]) {
    this.set("colourEngine", engine);
  }

  get density() {
    return this.get().density;
  }

  setDensity(density: TypeTheme["density"]) {
    this.set("density", density);
  }

  get radius() {
    return this.get().radius;
  }

  setRadius(radius: number) {
    this.set("radius", radius);
  }

  setRailWidth(value: number) {
    this.set("railWidth", Math.min(88, Math.max(56, value)));
  }
  setSidebarWidth(value: number) {
    this.set("sidebarWidth", Math.min(360, Math.max(220, value)));
  }
  setIconSize(value: number) {
    this.set("iconSize", Math.min(32, Math.max(16, value)));
  }

  get appearancePreset() {
    return this.get().appearancePreset;
  }

  setAppearancePreset(id: string) {
    this.set("appearancePreset", id);
  }

  get surfaces() {
    return this.get().surfaces;
  }

  setSurfaces(surfaces: TypeTheme["surfaces"]) {
    this.set("surfaces", surfaces);
  }

  /**
   * Apply a curated Appearance Studio preset (accent + surfaces + chrome).
   */
  applyAppearancePreset(preset: {
    id: string;
    accent: string;
    iconAccent: string;
    mode: "dark" | "light";
    swatches: [string, string, string, string];
    radius?: number;
    density?: TypeTheme["density"];
  }) {
    this.set("appearancePreset", preset.id);
    this.set("preset", "zrzur");
    this.set("colourEngine", "zrzur");
    this.set("mode", preset.mode);
    this.set("m3Accent", preset.accent);
    this.set("iconAccent", preset.iconAccent);
    // stored surfaces are the dark ones: a light theme keeps the default
    // dark surfaces, so switching the mode to Dark later still looks right
    this.set(
      "surfaces",
      preset.mode === "light"
        ? { ...this.default().surfaces }
        : {
            bgApp: preset.swatches[0],
            bgRail: preset.swatches[0],
            bgSidebar: preset.swatches[1],
            bgChat: preset.swatches[2],
            bgRaised: preset.swatches[3],
          },
    );
    if (preset.radius != null) this.set("radius", preset.radius);
    if (preset.density) this.set("density", preset.density);
  }
}
