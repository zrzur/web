import type { JSX } from "solid-js";

import { readableName, readableTheme } from "./profileTheme";
import { type UserStyle, nameStyle, themeColours } from "./userStyle";

/**
 * The display name on a profile card or full profile: one name on screen, so
 * a spectrum may flow and a sheen may pass. A themed card has its own deep
 * surface whatever the app's theme is, so its name is drawn for a dark
 * surface (never darkened for a light app), and keeps its chosen colour only
 * where that reads on the theme.
 */
export function profileNameStyle(
  chosen: UserStyle | undefined,
): JSX.CSSProperties {
  const theme = themeColours(chosen);
  if (!theme) return nameStyle(chosen, { moving: true });
  const reads = readableName(chosen?.name_colour ?? [], readableTheme(theme));
  return reads
    ? nameStyle(chosen, { moving: true, surface: "dark" })
    : {
        ...nameStyle(chosen, { colour: false, moving: true, surface: "dark" }),
        color: "var(--profile-ink, var(--z-fg-primary))",
      };
}
