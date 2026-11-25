/**
 * The ids of Zrzur's own profile frames. Kept apart from the art
 * (`builtinFrames.ts`, `pixel/`) and from their sizes (`frameRoom.ts`), so
 * the style, which every name and avatar needs on the first load, carries
 * nothing else.
 */

export const PROFILE_FRAME_IDS = [
  "crystal",
  // the set of 2026-11-25, drawn ahead of time (pixel/set/)
  "desert-lanterns",
  "damascus-jasmine",
  "autumn-maple",
  "coral-reef",
  "mushroom-forest",
  "zrzur-neon",
  "zrzur-arcade",
  "zrzur-flock",
] as const;

export type ProfileFrameId = (typeof PROFILE_FRAME_IDS)[number];

export const isProfileFrameId = (
  id: string | undefined,
): id is ProfileFrameId =>
  !!id && (PROFILE_FRAME_IDS as readonly string[]).includes(id);
