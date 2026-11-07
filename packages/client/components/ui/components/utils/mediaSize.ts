/** Fit the entire image inside the chat preview without changing its aspect ratio. */
export function fitMessageMedia(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 160, height: 120 };
  }
  const minimumScale = Math.max(1, 160 / width, 120 / height);
  const scale = Math.min(minimumScale, 420 / width, 420 / height);
  return { width: width * scale, height: height * scale };
}
