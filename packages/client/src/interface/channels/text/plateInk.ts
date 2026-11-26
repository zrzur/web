/**
 * The words of a member row that sits on a nameplate. They take the theme's
 * own ink with a halo of the opposite tone, readable on the page and on the
 * art alike.
 *
 * A name that carries a colour keeps it, with everything inside it:
 * - the person's own chosen colour (`data-own-colour`, set by `Username`):
 *   it is their choice as much as the plate is (an ink forced over it drew
 *   the owner's blue name white, 2026-11-24);
 * - a server role colour (`data-role-colour`, set by `Username` when they
 *   chose none): a role colour shows wherever the person chose no colour, a
 *   plate included (the ink drew every role colour on a plate white,
 *   2026-11-24).
 */
export const PLATE_INK =
  "&[data-plated] > :not([data-nameplate]) *:not([data-own-colour], [data-own-colour] *, [data-role-colour], [data-role-colour] *)";

/**
 * A name in its own or a role colour inside a plated row: the ink's fill is
 * set on the boxes around it and would be inherited, so it takes it back.
 * Its own style (an inline colour, a gradient's transparent fill) still wins
 * over this, as it sits on the box inside.
 */
export const PLATE_NAME_COLOUR =
  "&[data-plated] :is([data-own-colour], [data-role-colour])";

/**
 * A name in its own colour also drops the halo it would inherit: its effect
 * draws its own. A role-coloured name keeps the plate's halo, so it reads on
 * the art (a gradient drops it in `ColouredText`, as a shadow would paint
 * over its clipped fill).
 */
export const PLATE_OWN_COLOUR = "&[data-plated] [data-own-colour]";
