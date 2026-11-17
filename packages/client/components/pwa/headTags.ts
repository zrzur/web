/**
 * iPhone and iPad: link the launch images, so the installed app opens on the
 * mark instead of a blank screen. iOS picks the image whose query matches
 * the screen. Added by script, on iOS only, so index.html stays small for
 * everyone else.
 */
import { IOS_SCREENS, splashFile, splashMedia } from "./iosScreens";

export function addIOSLaunchImages(
  doc: Document = document,
  base: string = import.meta.env.BASE_URL,
) {
  if (doc.querySelector('link[rel="apple-touch-startup-image"]')) return;
  for (const screen of IOS_SCREENS) {
    const link = doc.createElement("link");
    link.rel = "apple-touch-startup-image";
    link.media = splashMedia(screen);
    link.href = `${base}assets/web/splash/${splashFile(screen)}`;
    doc.head.append(link);
  }
}
