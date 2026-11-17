/**
 * iPhone and iPad screens that get a launch image (portrait, in CSS pixels).
 * iOS shows a launch image only when one matches the screen exactly; any
 * other device starts on the plain frame colour. scripts/pwaIcons.mjs draws
 * the files, iosLaunch.ts links them.
 */
export interface IOSScreen {
  width: number;
  height: number;
  ratio: number;
}

export const IOS_SCREENS: IOSScreen[] = [
  { width: 320, height: 568, ratio: 2 },
  { width: 375, height: 667, ratio: 2 },
  { width: 414, height: 736, ratio: 3 },
  { width: 375, height: 812, ratio: 3 },
  { width: 414, height: 896, ratio: 2 },
  { width: 414, height: 896, ratio: 3 },
  { width: 390, height: 844, ratio: 3 },
  { width: 428, height: 926, ratio: 3 },
  { width: 393, height: 852, ratio: 3 },
  { width: 430, height: 932, ratio: 3 },
  { width: 402, height: 874, ratio: 3 },
  { width: 440, height: 956, ratio: 3 },
  { width: 768, height: 1024, ratio: 2 },
  { width: 810, height: 1080, ratio: 2 },
  { width: 820, height: 1180, ratio: 2 },
  { width: 834, height: 1194, ratio: 2 },
  { width: 1024, height: 1366, ratio: 2 },
];

/** File name of a screen's launch image: its size in real pixels */
export function splashFile(screen: IOSScreen) {
  return `${screen.width * screen.ratio}x${screen.height * screen.ratio}.png`;
}

/** The media query that matches exactly this screen, held upright */
export function splashMedia(screen: IOSScreen) {
  return `(device-width: ${screen.width}px) and (device-height: ${screen.height}px) and (-webkit-device-pixel-ratio: ${screen.ratio}) and (orientation: portrait)`;
}
