import type { CommunityKind } from "../communityApi";

import { STUDIO_SPECS } from "./studioModel";

/** Scale in percent of "fills the frame", and a shift in percent of the frame */
export type Fit = { scale: number; x: number; y: number };

export const FIT_DEFAULT: Fit = { scale: 100, x: 0, y: 0 };
export const FIT_SCALE = { min: 40, max: 160 } as const;
export const FIT_SHIFT = { min: -30, max: 30 } as const;

export const fitChanged = (fit: Fit) =>
  fit.scale !== FIT_DEFAULT.scale || fit.x !== 0 || fit.y !== 0;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function clampFit(fit: Fit): Fit {
  return {
    scale: clamp(Math.round(fit.scale), FIT_SCALE.min, FIT_SCALE.max),
    x: clamp(Math.round(fit.x), FIT_SHIFT.min, FIT_SHIFT.max),
    y: clamp(Math.round(fit.y), FIT_SHIFT.min, FIT_SHIFT.max),
  };
}

/**
 * Where the image is drawn in the frame of its type. At 100 % it covers the
 * frame without leaving a gap (a decoration is square, so it simply fills);
 * the shift moves it by a share of the frame.
 */
export function fitRect(
  kind: CommunityKind,
  width: number,
  height: number,
  fit: Fit,
) {
  const frame = STUDIO_SPECS[kind];
  const cover = Math.max(frame.width / width, frame.height / height);
  const scale = cover * (fit.scale / 100);
  const w = width * scale;
  const h = height * scale;
  return {
    frame: { width: frame.width, height: frame.height },
    x: (frame.width - w) / 2 + (fit.x / 100) * frame.width,
    y: (frame.height - h) / 2 + (fit.y / 100) * frame.height,
    width: w,
    height: h,
  };
}

/**
 * Whether the file goes up as it is. A still image that already has the
 * frame's size and was not moved is not redrawn, so nothing is recompressed
 * for no reason; an animated file is never redrawn (that would keep one
 * frame).
 */
export function needsRedraw(
  kind: CommunityKind,
  width: number,
  height: number,
  fit: Fit,
  animated: boolean,
) {
  if (animated) return false;
  const frame = STUDIO_SPECS[kind];
  return fitChanged(fit) || width !== frame.width || height !== frame.height;
}

/** The still image redrawn into its frame, as the PNG that is uploaded */
export async function renderFit(
  image: CanvasImageSource,
  kind: CommunityKind,
  width: number,
  height: number,
  fit: Fit,
  name: string,
): Promise<File> {
  const rect = fitRect(kind, width, height, fit);
  const canvas = document.createElement("canvas");
  canvas.width = rect.frame.width;
  canvas.height = rect.frame.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("canvas");
  return new File([blob], `${name.replace(/\.[^.]+$/, "") || "design"}.png`, {
    type: "image/png",
  });
}
