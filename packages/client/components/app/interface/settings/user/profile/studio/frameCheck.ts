// relative, so unit tests run without the app aliases
import {
  FRAME_ALPHA_LIMIT,
  FRAME_FILE,
  FRAME_MAX_FRAMES,
  FRAME_TEMPLATE,
} from "../../../../../../ui/components/features/profiles/frames/communityFrame";

/**
 * The part of the card a frame's art lies over, from the card's top in
 * template px: the banner (the card's banner is 3:1 of its width, 113 px of a
 * 340 px card), the avatar and the name under it, then the profile text.
 */
export type FrameCoverPlace = "banner" | "name" | "text";

/** Where each part of the card starts, in template px from the template's top */
const PLACE_TOP: Record<FrameCoverPlace, number> = {
  banner: FRAME_TEMPLATE.card.top,
  name: FRAME_TEMPLATE.card.top + 110,
  text: FRAME_TEMPLATE.card.top + 210,
};

/** What the safe-area check found */
export type FrameCover = {
  /** drawn pixels inside the safe zone and outside the crest window */
  pixels: number;
  /** the part of the card most of them lie over */
  place?: FrameCoverPlace;
  /** the drawn box inside the safe zone, in file pixels */
  box?: { left: number; top: number; right: number; bottom: number };
  /** a moving frame: the first picture (from 0) that covers the card */
  frame?: number;
};

/**
 * The most pictures of a moving frame that are checked, the server's frame
 * limit: a file with more is refused there anyway.
 */
export { FRAME_MAX_FRAMES };

/**
 * The safe-area rule on every picture of a moving frame, as the server checks
 * it: the art may not pass over the name later in its loop. Stops at the
 * first picture that covers the card, and after `FRAME_MAX_FRAMES` pictures.
 */
export async function frameCoverOfFrames(
  frames:
    | Iterable<Uint8ClampedArray | Uint8Array>
    | AsyncIterable<Uint8ClampedArray | Uint8Array>,
  width: number,
  height: number,
): Promise<FrameCover> {
  let frame = 0;
  for await (const data of frames) {
    const cover = frameCover(data, width, height);
    if (cover.pixels) return { ...cover, frame };
    if (++frame >= FRAME_MAX_FRAMES) break;
  }
  return { pixels: 0 };
}

/**
 * The backend's safe-area rule (autumn `check_frame_safe_area`): inside the
 * card, less 10 px on every side, nothing may be drawn (alpha over 16 of
 * 255), except in the crest window over the middle of the banner. `data` is
 * RGBA of a file of the frame's exact size.
 */
export function frameCover(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): FrameCover {
  const scale = width / FRAME_TEMPLATE.width;
  const rect = (r: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }) => ({
    left: r.left * scale,
    top: r.top * scale,
    right: r.right * scale,
    bottom: r.bottom * scale,
  });
  const safe = rect(FRAME_TEMPLATE.safe);
  const crest = rect(FRAME_TEMPLATE.crest);
  const counts: Record<FrameCoverPlace, number> = {
    banner: 0,
    name: 0,
    text: 0,
  };
  let pixels = 0;
  let box: FrameCover["box"];
  const bottom = Math.min(height, safe.bottom);
  const right = Math.min(width, safe.right);
  for (let y = safe.top; y < bottom; y++) {
    const inCrestRow = y >= crest.top && y < crest.bottom;
    const place: FrameCoverPlace =
      y >= PLACE_TOP.text * scale
        ? "text"
        : y >= PLACE_TOP.name * scale
          ? "name"
          : "banner";
    for (let x = safe.left; x < right; x++) {
      if (inCrestRow && x >= crest.left && x < crest.right) continue;
      if (data[(y * width + x) * 4 + 3] <= FRAME_ALPHA_LIMIT) continue;
      pixels++;
      counts[place]++;
      box = box
        ? {
            left: Math.min(box.left, x),
            top: Math.min(box.top, y),
            right: Math.max(box.right, x + 1),
            bottom: Math.max(box.bottom, y + 1),
          }
        : { left: x, top: y, right: x + 1, bottom: y + 1 };
    }
  }
  if (!pixels) return { pixels };
  const place = (Object.keys(counts) as FrameCoverPlace[]).reduce((a, b) =>
    counts[b] > counts[a] ? b : a,
  );
  return { pixels, place, box };
}

/** The file is the frame's exact size */
export const isFrameSize = (width: number, height: number) =>
  width === FRAME_FILE.width && height === FRAME_FILE.height;
