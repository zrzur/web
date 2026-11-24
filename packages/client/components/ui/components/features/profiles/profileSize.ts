import { createContext, useContext } from "solid-js";

/** Where profile content is drawn: the small card or the full profile */
export type ProfileSize = "card" | "full";

/** Set once by the profile body; sections read it instead of taking a prop each */
export const ProfileSizeContext = createContext<() => ProfileSize>(
  () => "card" as const,
);

export const useProfileSize = () => useContext(ProfileSizeContext);

/**
 * The width of the profile's content in css px, once measured (set by the
 * profile body). A framed profile on a phone stands in from the screen's
 * edges, so it is narrower than the full profile's usual width.
 */
export const ProfileWidthContext = createContext<() => number | undefined>(
  () => undefined,
);

/** Narrowest content that still holds four tiles whose names fit */
export const FOUR_TILES_WIDTH = 336;

/**
 * Tiles (creations, worn items) in one row before Show more: four on the
 * full profile, three on the card and on a full profile too narrow for four
 * (their names were cut short: "Moon h…")
 */
export const tilesShown = (size: ProfileSize, width?: number) =>
  size === "full" && (width === undefined || width >= FOUR_TILES_WIDTH) ? 4 : 3;

/**
 * A full profile measured narrower than four tiles need (a framed one on a
 * phone); the card is always drawn at its own width and never counts
 */
export const narrowProfile = (size: ProfileSize, width?: number) =>
  size === "full" && width !== undefined && width < FOUR_TILES_WIDTH;

/** Tiles in one row where these sections are drawn */
export function useTilesShown() {
  const size = useProfileSize();
  const width = useContext(ProfileWidthContext);
  return () => tilesShown(size(), width());
}

/** Achievement icons under the games: two rows of the panel's width */
export const achievementsShown = (size: ProfileSize) =>
  size === "full" ? 20 : 14;
