import type { JSX } from "solid-js";

import {
  contrast,
  mixColours,
  readableTheme,
  themeSurfaces,
} from "./profileTheme";
import { type UserStyle, nameStyle, themeColours } from "./userStyle";

const AA = 4.5;
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A name colour that reads at 4.5:1 on every one of these dark surfaces: the
 * colour itself when it does, else the same hue lightened step by step
 * toward white (the mirror of `nameColourForLight`). Undefined only when no
 * shade of it reads.
 */
export function readableNameColour(hex: string, surfaces: string[]) {
  if (!HEX.test(hex)) return undefined;
  for (let lift = 0; lift <= 1.0001; lift += 0.02) {
    // judge the rounded colour that will be drawn, not the exact one
    const shade = mixColours(hex, "#ffffff", Math.min(lift, 1));
    if (surfaces.every((surface) => contrast(shade, surface) >= AA))
      return shade;
  }
  return undefined;
}

/**
 * The display name on a profile card or full profile: one name on screen, so
 * a spectrum may flow and a sheen may pass.
 *
 * A themed card has its own deep surface whatever the app's theme is, so its
 * name is drawn for a dark surface (never darkened for a light app). It keeps
 * the person's chosen colours: each one that does not read on the theme is
 * lightened until it does, so a blue stays blue (it used to turn white,
 * 2026-11-24). Only when no shade of a colour reads does the name take the
 * card's ink; the font and the effect stay either way.
 */
export function profileNameStyle(
  chosen: UserStyle | undefined,
): JSX.CSSProperties {
  const theme = themeColours(chosen);
  if (!theme) return nameStyle(chosen, { moving: true });
  const surfaces = themeSurfaces(readableTheme(theme));
  const picked = (chosen?.name_colour ?? []).filter((c) => HEX.test(c));
  const shades = picked.map((c) => readableNameColour(c, surfaces));
  return shades.every((shade) => shade)
    ? nameStyle(
        { ...chosen, name_colour: shades as string[] },
        { moving: true, surface: "dark" },
      )
    : {
        ...nameStyle(chosen, { colour: false, moving: true, surface: "dark" }),
        color: "var(--profile-ink, var(--z-fg-primary))",
      };
}
