import { type CommunityKind, artFit } from "../communityApi";

import { STUDIO_SPECS } from "./studioModel";

/** What the studio knows about a picked file before it is uploaded */
export type FileFacts = {
  name: string;
  type: string;
  bytes: number;
  width: number;
  height: number;
  /** more than one frame; undefined for a WebM (the server makes the image) */
  animated?: boolean;
  /** share of fully transparent pixels of the first frame, 0 to 1 */
  clear?: number;
  /** decorations: share of the avatar circle the art covers, 0 to 1 */
  overFace?: number;
};

export type CheckState = "ok" | "warn" | "fail";

export type FileCheckId =
  | "size"
  | "format"
  | "weight"
  | "transparent"
  | "safe"
  | "motion";

export type FileCheck = {
  id: FileCheckId;
  state: CheckState;
  /** why it is not ok, for the words beside it */
  reason?:
    | "square"
    | "wide"
    | "tall"
    | "small"
    | "no-clear"
    | "over-face"
    | "too-solid"
    | "still"
    | "video";
};

/** Art over this share of the avatar hides the face */
export const FACE_COVER_LIMIT = 0.08;
/** The server refuses an effect that covers more than half of a frame */
export const EFFECT_COVER_LIMIT = 0.5;

const isVideo = (facts: FileFacts) => facts.type === "video/webm";

/**
 * The list beside the canvas. Size limits and the type were already checked
 * when the file was picked (it is refused there); these are the facts a
 * creator can still fix before sending.
 */
export function fileChecks(kind: CommunityKind, facts: FileFacts): FileCheck[] {
  const spec = STUDIO_SPECS[kind];
  const checks: FileCheck[] = [];

  const shape = artFit(kind, facts.width, facts.height);
  const small = facts.width < spec.width / 2 || facts.height < spec.height / 2;
  checks.push({
    id: "size",
    // the server refuses any other shape for an effect
    state: shape
      ? kind === "effects"
        ? "fail"
        : "warn"
      : small
        ? "warn"
        : "ok",
    reason: shape ?? (small ? "small" : undefined),
  });
  checks.push({ id: "format", state: "ok" });
  checks.push({ id: "weight", state: "ok" });

  if (isVideo(facts)) {
    checks.push({ id: "motion", state: "ok", reason: "video" });
    return checks;
  }

  if (kind !== "nameplates" && facts.clear !== undefined) {
    const solid = 1 - facts.clear;
    if (kind === "effects") {
      checks.push({
        id: "transparent",
        state: solid > EFFECT_COVER_LIMIT ? "fail" : "ok",
        reason: solid > EFFECT_COVER_LIMIT ? "too-solid" : undefined,
      });
    } else {
      checks.push({
        id: "transparent",
        state: facts.clear < 0.05 ? "warn" : "ok",
        reason: facts.clear < 0.05 ? "no-clear" : undefined,
      });
    }
  }

  if (kind === "decorations" && facts.overFace !== undefined) {
    const over = facts.overFace > FACE_COVER_LIMIT;
    checks.push({
      id: "safe",
      state: over ? "warn" : "ok",
      reason: over ? "over-face" : undefined,
    });
  }

  if (spec.mustMove || facts.animated) {
    const still = spec.mustMove && facts.animated === false;
    checks.push({
      id: "motion",
      state: still ? "fail" : "ok",
      reason: still ? "still" : undefined,
    });
  }
  return checks;
}

/** A failed check keeps the design from going on */
export const fileRefused = (checks: FileCheck[]) =>
  checks.some((check) => check.state === "fail");

/**
 * Whether the bytes hold more than one frame: an animated PNG has an `acTL`
 * chunk before its image data, an animated WebP an `ANIM` chunk, and a GIF
 * more than one image block.
 */
export function isAnimated(bytes: Uint8Array, type: string) {
  const text = (at: number, word: string) => {
    for (let i = 0; i < word.length; i++)
      if (bytes[at + i] !== word.charCodeAt(i)) return false;
    return true;
  };
  if (type === "image/png" || type === "image/apng") {
    // chunks: 4 length, 4 name, data, 4 checksum
    let at = 8;
    while (at + 8 <= bytes.length) {
      const length =
        ((bytes[at] << 24) |
          (bytes[at + 1] << 16) |
          (bytes[at + 2] << 8) |
          bytes[at + 3]) >>>
        0;
      if (text(at + 4, "acTL")) return true;
      if (text(at + 4, "IDAT") || text(at + 4, "IEND")) return false;
      at += 12 + length;
    }
    return false;
  }
  if (type === "image/webp") {
    let at = 12;
    while (at + 8 <= bytes.length) {
      if (text(at, "ANIM")) return true;
      const length =
        bytes[at + 4] |
        (bytes[at + 5] << 8) |
        (bytes[at + 6] << 16) |
        (bytes[at + 7] << 24);
      at += 8 + length + (length & 1);
    }
    return false;
  }
  if (type === "image/gif") {
    if (bytes.length < 13) return false;
    // header, logical screen, optional global colour table
    let at = 13;
    if (bytes[10] & 0x80) at += 3 * (1 << ((bytes[10] & 7) + 1));
    let frames = 0;
    const skipBlocks = () => {
      while (at < bytes.length && bytes[at] !== 0) at += bytes[at] + 1;
      at++;
    };
    while (at < bytes.length) {
      const block = bytes[at];
      if (block === 0x2c) {
        if (++frames > 1) return true;
        const packed = bytes[at + 9];
        at += 10;
        if (packed & 0x80) at += 3 * (1 << ((packed & 7) + 1));
        at++; // LZW code size
        skipBlocks();
      } else if (block === 0x21) {
        at += 2;
        skipBlocks();
      } else break;
    }
    return false;
  }
  return false;
}

/**
 * What the pixels of the first frame say: how much is see-through, and for a
 * decoration how much of the avatar circle the art covers. `data` is RGBA.
 */
export function pixelFacts(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  kind: CommunityKind,
) {
  let clear = 0;
  let inFace = 0;
  let overFace = 0;
  // the avatar is two thirds of the art, centred; a little inside its edge,
  // where a ring may touch it, is not "over the face"
  const radius = (Math.min(width, height) / 3) * 0.86;
  const cx = width / 2;
  const cy = height / 2;
  const measureFace = kind === "decorations";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 16) clear++;
      if (measureFace) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          inFace++;
          if (alpha >= 128) overFace++;
        }
      }
    }
  }
  const total = width * height || 1;
  return {
    clear: clear / total,
    overFace: measureFace && inFace ? overFace / inFace : undefined,
  };
}
