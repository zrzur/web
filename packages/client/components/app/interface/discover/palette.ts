/**
 * Discover and Designs wear the app's own Midnight Pulse tokens (design
 * direction 2026-11-03): solid surfaces with a thin edge, one action
 * colour, no glass, glow or page gradient. The `--dz-*` names the pages
 * read are mapped onto the app's `--z-*` tokens, so a theme the person
 * picked in the app reaches Discover too, and the standalone sites get the
 * default theme.
 *
 * Fallbacks are the default dark theme (brand.md section 4).
 */
export const PALETTE = {
  frame: "#0D0E16",
  nav: "#171925",
  page: "#1D1F2D",
  raised: "#242638",
  selected: "#303348",
  floating: "#11121C",
  edge: "#303348",
  edgeStrong: "#4A4E6A",
  title: "#F7F8FC",
  text: "#F0F1F8",
  textSecondary: "#A1A5B8",
  textMuted: "#8C90A6",
  action: "#E0195F",
  actionHover: "#C8155A",
  actionPressed: "#B0124F",
  actionText: "#FF7AA8",
  onAction: "#FFFFFF",
  // Discover's own accent (brand.md, feature accents)
  discover: "#245FC7",
  discoverText: "#8DB4FF",
} as const;

/**
 * Every listing's picture is a small piece of the same night sky, with the
 * same birds as the big one. Artwork: dark in every theme.
 */
export const ART_SKY = "#141B3A";

/** Rich skies for banners that have no image: one per listing, always */
export const ART_SKIES = [
  "#1E3A8A",
  "#0F5E63",
  "#4C2A85",
  "#7A2348",
  "#8A4B14",
  "#1F6B45",
] as const;
export const ART_INK = "#F7F8FC";

const z = (name: string, fallback: string) => `var(--z-${name}, ${fallback})`;

/** The tokens Discover's parts read, for a `style` attribute */
export const paletteTokens = {
  // one palette for servers and bots: the deep frame colour is the page,
  // cards one step up, hover one more; white birds, mint for who is here,
  // Discover's blue for marks, pink only for the action
  "--z-btn-lift": "none",
  "--z-btn-pressed": "none",
  "--z-btn-surface-lift": "none",
  "--z-field-shadow": "none",
  // paid places are labelled, not coloured (Feather keeps its gradient)
  "--z-premium": z("accent-fill", PALETTE.action),
  "--z-premium-text": z("fg-primary", PALETTE.text),
  "--z-premium-gradient": z("accent-fill", PALETTE.action),
  "--z-on-premium": z("on-accent", PALETTE.onAction),
  // the hero band and its flock
  "--dz-band": z("bg-frame", PALETTE.frame),
  "--dz-flock": z("accent-fill", PALETTE.action),
  "--dz-bird": z("fg-primary", PALETTE.title),
  // pictures and the owners' card: a piece of the same night
  "--dz-sky": ART_SKY,
  "--dz-wash-blue": `color-mix(in srgb, ${z("discover", PALETTE.discover)} 28%, transparent)`,
  // the soft light at the top, the same as on Designs
  "--dz-glow": `radial-gradient(90% 90% at 50% -20%, color-mix(in srgb, ${z("accent-fill", PALETTE.action)} 16%, transparent), transparent 70%)`,
  "--dz-glow-fade": "linear-gradient(black 55%, transparent)",
  // words on listing art: the art stays dark in every theme
  "--dz-on-art": PALETTE.title,
  "--dz-mark": z("fg-secondary", PALETTE.textSecondary),
  "--dz-page": z("bg-frame", PALETTE.frame),
  "--dz-base": z("bg-frame", PALETTE.frame),
  "--dz-bar": z("bg-frame", PALETTE.frame),
  "--dz-surface-solid": z("bg-sidebar", PALETTE.nav),
  // a chosen filter is raised, never filled: pink is for the one action
  "--dz-chosen": `color-mix(in srgb, ${z("bg-sidebar", PALETTE.nav)} 84%, ${z("fg-primary", PALETTE.text)})`,
  "--dz-on-chosen": z("fg-primary", PALETTE.text),
  // a solid plate under words over banner artwork
  "--dz-glass": z("bg-floating", PALETTE.floating),
  "--dz-wash": `color-mix(in srgb, ${z("accent-fill", PALETTE.action)} 14%, transparent)`,
  "--dz-glass-fill": z("bg-sidebar", PALETTE.nav),
  "--dz-glass-hover": `color-mix(in srgb, ${z("bg-sidebar", PALETTE.nav)} 90%, ${z("fg-primary", PALETTE.text)})`,
  "--dz-glass-focus": z("bg-sidebar", PALETTE.nav),
  "--dz-glass-blur": "none",
  "--dz-glass-lift": "none",
  "--dz-edge": z("nav-selected", PALETTE.edge),
  "--dz-placeholder": z("fg-muted", PALETTE.textMuted),
} as const;
