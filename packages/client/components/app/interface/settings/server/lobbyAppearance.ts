import type { JSX } from "solid-js";
import type { ServerLobby } from "@zrzur/sdk/solid";

/** Accept only persisted six-digit colours, never arbitrary CSS. */
export const lobbyColour = (value?: string) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;

/** Relative luminance used for automatic foregrounds and contrast validation. */
function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((part) => {
      const n = parseInt(part, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

/** WCAG contrast ratio between two validated colours. */
export function lobbyContrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Pick a readable foreground even for yellow, mint or near-white accents. */
export const lobbyInk = (hex: string) =>
  lobbyContrast(hex, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#101116";

/** Apply saved server appearance only within the lobby, preserving the app shell. */
export function lobbyStyle(lobby: ServerLobby): JSX.CSSProperties {
  const a = lobby.appearance ?? {};
  const accent = lobbyColour(lobby.accent);
  const background = lobbyColour(a.background);
  const surface = lobbyColour(a.surface);
  const text =
    lobbyColour(a.text) ?? (background ? lobbyInk(background) : undefined);
  return {
    "--lobby-accent": accent,
    "--lobby-on-accent": accent ? lobbyInk(accent) : undefined,
    "--lobby-secondary":
      lobbyColour(a.secondary) ?? "var(--z-highlight, #D462B3)",
    "--lobby-blend": `${a.blend ?? 28}%`,
    "--lobby-banner-paint":
      a.secondary || a.angle != null || a.blend != null
        ? "linear-gradient(var(--lobby-angle), color-mix(in srgb, var(--lobby-accent, var(--z-accent-fill)) var(--lobby-blend), var(--z-bg-chat)), color-mix(in srgb, var(--lobby-secondary) var(--lobby-blend), var(--z-bg-chat)))"
        : undefined,
    "--lobby-angle": `${a.angle ?? 120}deg`,
    "--lobby-banner-height": `${a.banner_height ?? 208}px`,
    "--lobby-radius": `${a.radius ?? 14}px`,
    "--lobby-card-pad": a.density === "Compact" ? "14px" : "22px",
    "--lobby-gap": a.density === "Compact" ? "8px" : "12px",
    // Callers: Lobby.tsx L619 style={lobbyStyle(lobby())}; tests in
    // lobbyAppearance.test.ts. Only source for lobby CSS vars.
    // Lift cards one step above the page so a dark custom background never
    // becomes a black void with black boxes (surface ladder).
    "--lobby-surface":
      surface ??
      (background
        ? `color-mix(in srgb, ${background} 90%, ${text ?? "#FFFFFF"} 10%)`
        : "color-mix(in srgb, var(--z-bg-raised) 65%, var(--z-bg-chat))"),
    "--lobby-card-ink": surface
      ? (lobbyColour(a.text) ?? lobbyInk(surface))
      : undefined,
    "--lobby-heading-colour":
      accent && (background || surface)
        ? lobbyContrast(accent, surface ?? background!) >= 3
          ? accent
          : (text ?? lobbyInk(surface!))
        : "var(--lobby-accent, var(--z-accent-text))",
    "--z-bg-chat": background,
    // Only remint page surfaces when a page background is set. Surface-only
    // customisation stays on cards via data-custom-surface + --lobby-surface.
    "--z-bg-raised": background
      ? (surface ??
        `color-mix(in srgb, ${background} 90%, ${text ?? "#FFFFFF"} 10%)`)
      : undefined,
    "--z-card-bg": background
      ? `linear-gradient(180deg, color-mix(in srgb, ${text ?? "#FFFFFF"} 7%, var(--lobby-surface)), var(--lobby-surface))`
      : undefined,
    "--z-fg-primary": text,
    "--z-fg-secondary": text
      ? `color-mix(in srgb, ${text} 84%, transparent)`
      : undefined,
    "--z-fg-muted": text
      ? `color-mix(in srgb, ${text} 72%, transparent)`
      : undefined,
    "--z-border-subtle": text
      ? `color-mix(in srgb, ${text} 14%, transparent)`
      : undefined,
    "--z-field-border": text
      ? `color-mix(in srgb, ${text} 22%, transparent)`
      : undefined,
    "--z-field-bg": background
      ? (surface ??
        `color-mix(in srgb, ${background} 84%, ${text ?? "#FFFFFF"} 16%)`)
      : undefined,
    "--z-nav-hover": text
      ? `color-mix(in srgb, ${text} 7%, transparent)`
      : undefined,
  };
}
