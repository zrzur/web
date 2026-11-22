/**
 * One size for a profile, wherever it is shown on a desktop: the card that
 * opens from a name, the full profile, and every preview of a look (Designs,
 * the frame picker). Owner, 2026-11-22: the same size everywhere, never
 * changing, like the profile popout of the big chat apps (about 300 x 620).
 * A phone shows the profile as a sheet the width of the screen instead.
 */
export const PROFILE_WIDTH = 300;
export const PROFILE_HEIGHT = 620;

/** The banner is a third of the profile's width */
export const PROFILE_BANNER = Math.round(PROFILE_WIDTH / 3);

/** The box of a profile: fixed, but never taller than the window allows */
export const profileBox = {
  width: `${PROFILE_WIDTH}px`,
  height: `min(${PROFILE_HEIGHT}px, calc(100dvh - 32px))`,
} as const;
