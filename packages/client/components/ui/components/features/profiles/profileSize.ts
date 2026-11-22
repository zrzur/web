import { createContext, useContext } from "solid-js";

/** Where profile content is drawn: the small card or the full profile */
export type ProfileSize = "card" | "full";

/** Set once by the profile body; sections read it instead of taking a prop each */
export const ProfileSizeContext = createContext<() => ProfileSize>(
  () => "card" as const,
);

export const useProfileSize = () => useContext(ProfileSizeContext);

/** Tiles (creations, worn items) in one row before Show more */
export const tilesShown = (size: ProfileSize) => (size === "full" ? 4 : 3);

/** Achievement icons under the games: two rows of the panel's width */
export const achievementsShown = (size: ProfileSize) =>
  size === "full" ? 20 : 14;
