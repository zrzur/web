/**
 * iOS 26 lays an installed app (Home Screen, black-translucent status bar,
 * viewport-fit=cover) out in a box that is shorter than the screen by the
 * height of the status bar: everything anchored to the bottom (the tab bar,
 * sheets, the message box above the keyboard) ends that much too high and a
 * dead band shows below it.
 *
 * The correction is measured, never assumed: it applies only when the box is
 * short by about the top safe area, so it switches itself off on a system
 * that lays the app out correctly.
 */
export interface ViewportMeasure {
  /** Height of a `position: fixed; top: 0; bottom: 0` box */
  fixedHeight: number;
  /** `screen.width` and `screen.height` (iOS does not swap them on rotation) */
  screenWidth: number;
  screenHeight: number;
  portrait: boolean;
  /** Top safe-area inset in px */
  safeTop: number;
}

/** How far around the top safe area the missing height may be */
const TOLERANCE = 12;

/**
 * Missing height at the bottom of the layout box in px; 0 when the layout is
 * right or the difference is not this fault (a split-screen window, a
 * keyboard, a device without a status-bar inset).
 */
export function viewportDeficit(m: ViewportMeasure): number {
  if (m.safeTop < 20 || m.fixedHeight <= 0) return 0;
  const full = m.portrait
    ? Math.max(m.screenWidth, m.screenHeight)
    : Math.min(m.screenWidth, m.screenHeight);
  const missing = Math.round(full - m.fixedHeight);
  if (missing < 8 || Math.abs(missing - m.safeTop) > TOLERANCE) return 0;
  return missing;
}

/** Read the live values; the probes leave the page as it was */
export function measureViewport(): ViewportMeasure {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none;padding-top:var(--z-safe-top,0px)";
  document.body.appendChild(probe);
  const fixedHeight = probe.getBoundingClientRect().height;
  const safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return {
    fixedHeight,
    safeTop,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    portrait: window.matchMedia("(orientation: portrait)").matches,
  };
}

/**
 * Keep `--viewport-deficit` on <html> current. Call only for an installed app
 * on iOS. Returns the function that stops it.
 */
export function trackShortViewport(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const style = document.documentElement.style;

  const update = () => {
    // a keyboard or a pinch zoom makes the box differ for other reasons:
    // keep the last value until the screen is at rest again
    const viewport = window.visualViewport;
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    if (parseFloat(style.getPropertyValue("--keyboard-inset")) > 0) return;
    style.setProperty(
      "--viewport-deficit",
      `${viewportDeficit(measureViewport())}px`,
    );
  };

  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(update, 250);
  };

  update();
  // the first layout of a cold start can still be settling
  later();
  // and iOS may give the tall page (styles.css) its full viewport a moment
  // later without any resize event: look once more
  const settled = setTimeout(update, 1500);
  window.addEventListener("resize", later);
  window.addEventListener("orientationchange", later);
  window.addEventListener("pageshow", later);

  return () => {
    clearTimeout(timer);
    clearTimeout(settled);
    window.removeEventListener("resize", later);
    window.removeEventListener("orientationchange", later);
    window.removeEventListener("pageshow", later);
  };
}
