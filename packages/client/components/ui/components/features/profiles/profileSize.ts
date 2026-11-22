import { createContext, useContext } from "solid-js";

/** Where profile content is drawn: the small card or the full profile */
export type ProfileSize = "card" | "full";

/** Set once by the profile body; sections read it instead of taking a prop each */
export const ProfileSizeContext = createContext<() => ProfileSize>(
  () => "card" as const,
);

export const useProfileSize = () => useContext(ProfileSizeContext);

/**
 * Tiles (creations, worn items) in one row before Show more. The card and
 * the full profile are the same width (size.ts), so the same three.
 */
export const tilesShown = (_size: ProfileSize) => 3;

/** Achievement icons under the games: two rows of seven, in either view */
export const achievementsShown = (_size: ProfileSize) => 14;
