import { PALETTE, paletteTokens } from "@revolt/app/interface/discover/palette";

const z = (name: string, fallback: string) => `var(--z-${name}, ${fallback})`;

/**
 * Designs wears the same Midnight Pulse tokens as Discover and the app:
 * solid surfaces, one action colour, no glass. The `--z-designs-*` names
 * the pages read map onto the app's tokens.
 */
export const designsTokens = {
  ...paletteTokens,
  "--z-designs-pink": z("accent-fill", PALETTE.action),
  "--z-designs-pink-text": z("accent-text", PALETTE.actionText),
  "--z-designs-fill": z("accent-fill", PALETTE.action),
  "--z-designs-fill-hover": z("accent-hover", PALETTE.actionHover),
  "--z-designs-fill-pressed": z("accent-pressed", PALETTE.actionPressed),
  "--z-designs-on-pink": z("on-accent", PALETTE.onAction),
  "--z-designs-pink-muted": `color-mix(in srgb, ${z("accent-fill", PALETTE.action)} 14%, transparent)`,
  // the deep ground of the hero and sign-in, not the chat navy
  "--z-designs-page": z("bg-frame", PALETTE.frame),
  "--z-designs-surface": z("bg-sidebar", PALETTE.nav),
  "--z-designs-surface-raised": z("bg-raised", PALETTE.raised),
  "--z-designs-well": z("bg-sidebar", PALETTE.nav),
  "--z-designs-button": z("bg-raised", PALETTE.raised),
  "--z-designs-button-hover": z("nav-selected", PALETTE.selected),
  "--z-designs-selected-bg": `color-mix(in srgb, ${z("accent-fill", PALETTE.action)} 14%, transparent)`,
  "--z-designs-divider": z("border-subtle", PALETTE.edge),
  "--z-designs-edge": z("border-subtle", PALETTE.edge),
  "--z-designs-edge-hover": z("border-strong", PALETTE.edgeStrong),
  "--z-designs-bar": z("bg-frame", PALETTE.frame),
  "--z-designs-text": z("fg-primary", PALETTE.text),
  "--z-designs-text-secondary": z("fg-secondary", PALETTE.textSecondary),
  "--z-designs-muted": z("fg-muted", PALETTE.textMuted),
  "--z-designs-glass": z("bg-raised", PALETTE.raised),
  "--z-designs-glass-hover": z("nav-selected", PALETTE.selected),
  "--z-designs-glass-focus": z("bg-raised", PALETTE.raised),
  "--z-designs-placeholder": z("fg-muted", PALETTE.textMuted),
  "--z-designs-pink-gradient": z("accent-fill", PALETTE.action),
  "--z-designs-pink-hover": z("accent-hover", PALETTE.actionHover),
  "--z-designs-pink-pressed": z("accent-pressed", PALETTE.actionPressed),
  // the ground designs are shown on: always dark, like a profile card, so a
  // preview looks the same in every app theme
  "--z-designs-art-ground": PALETTE.nav,
  "--z-designs-on-art": PALETTE.title,
  // the studio canvas also judges art on a light ground
  "--z-designs-art-light": "#F5F6FB",
  "--z-designs-on-light": "#171925",
  "--z-designs-on-art-muted": "rgb(247 248 252 / 0.72)",
  "--z-designs-on-art-edge": "rgb(255 255 255 / 0.14)",
  "--z-designs-status-online": z("presence-online", "#55DCC8"),
  // the soft light at the top of the page: the action colour, kept deep
  "--z-designs-glow": `color-mix(in srgb, ${z("accent-fill", PALETTE.action)} 16%, transparent)`,
  "--z-designs-glass-blur": "none",
  "--z-designs-glass-lift": "none",
} as const;
