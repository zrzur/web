/**
 * The words of a member row that sits on a nameplate. They take the theme's
 * own ink with a halo of the opposite tone, readable on the page and on the
 * art alike.
 *
 * A name in the person's own chosen colour (`data-own-colour`, set by
 * `Username`) keeps it, with everything inside it: the colour is their
 * choice as much as the plate is, and an ink forced over it would hide it
 * (it drew the owner's blue name white, 2026-11-24).
 */
export const PLATE_INK =
  "&[data-plated] > :not([data-nameplate]) *:not([data-own-colour], [data-own-colour] *)";

/**
 * A name in its own colour inside a plated row: the ink's fill and halo are
 * set on the boxes around it and would be inherited, so it takes them back.
 * Its own inline style (a gradient's transparent fill, an effect's shadow)
 * still wins over this.
 */
export const PLATE_OWN_COLOUR = "&[data-plated] [data-own-colour]";
