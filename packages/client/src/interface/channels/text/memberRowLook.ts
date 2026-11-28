import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

/*
 * A member list row: the one look shared by the server's member list
 * (MemberSidebar) and the Designs previews, so a design is previewed exactly
 * as it shows in a server.
 */

/**
 * Two-line member rows (name + status) are taller than channel rows
 */
export const memberRow = css({
  position: "relative",
  "& > *": {
    height: "var(--z-member-row-height, 44px)",
  },
  // keep the row's content above its nameplate
  "& > :not([data-nameplate])": {
    position: "relative",
    zIndex: 1,
  },
  // the name starts where the plate is still faint, so it takes the theme's
  // own ink with a halo of the opposite tone: white on dark themes, dark on
  // light ones, readable on the page and on the art alike. A name in its
  // own chosen colour or in a server role colour keeps it. Panda reads only
  // a written-out key, so these are `PLATE_INK`, `PLATE_NAME_COLOUR` and
  // `PLATE_OWN_COLOUR` (plateInk.ts) spelt out; plateInk.dom.test checks it.
  "&[data-plated] > :not([data-nameplate]) *:not([data-own-colour], [data-own-colour] *, [data-role-colour], [data-role-colour] *)":
    {
      color: "var(--z-plate-ink, #fff) !important",
      WebkitTextFillColor: "var(--z-plate-ink, #fff) !important",
      textShadow:
        "var(--z-plate-ink-halo, 0 0 2px rgb(0 0 0 / 60%), 0 1px 4px rgb(0 0 0 / 70%))",
    },
  // ...and takes back the fill it would inherit from the boxes around it
  "&[data-plated] :is([data-own-colour], [data-role-colour])": {
    WebkitTextFillColor: "currentColor",
  },
  // an own colour draws its own effect; a role colour keeps the plate's halo
  "&[data-plated] [data-own-colour]": {
    textShadow: "none",
  },
});

/**
 * Nameplate behind a member row: it fills the row's own box exactly (the box
 * that lights up on hover: 8 px in from each side, the row's full height,
 * the same rounding), and the row's words sit on it in white. The art is
 * stretched to the box, whose shape is close to the art's own; its faint
 * start runs under the avatar.
 */
export const nameplateLayer = css({
  position: "absolute",
  insetInlineStart: "8px",
  insetInlineEnd: "8px",
  top: 0,
  height: "var(--z-member-row-height, 44px) !important",
  borderRadius: "var(--z-shape-chip, var(--z-radius-sm, 6px))",
  pointerEvents: "none",
});

/**
 * Styles required to correctly display name and status
 */
export const NameStatusStack = styled("div", {
  base: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
});
