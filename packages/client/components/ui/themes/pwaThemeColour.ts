/** Default dark frame (brand "Midnight Pulse"), also in index.html and the manifest */
const DEFAULT_FRAME = "#0D0E16";

/** A plain colour the browser can use for its own bar (no var() references) */
function plain(value: string | undefined) {
  return value && !value.trim().startsWith("var(") ? value.trim() : undefined;
}

/**
 * Colour of the browser's own bar in the installed app (meta theme-color:
 * the Android status bar, the title bar of a desktop install). It matches
 * the frame colour, which is what shows in the status bar / notch strip
 * around #root, so the bar and the app read as one surface. While the
 * connection banner shows at the top, the bar takes the banner's colour.
 */
export function pwaThemeColour(
  props: Record<string, string>,
  bannerShown: boolean,
) {
  const frame = plain(props["--z-bg-frame"]) ?? DEFAULT_FRAME;
  if (bannerShown)
    return plain(props["--md-sys-color-primary-container"]) ?? frame;
  return frame;
}
