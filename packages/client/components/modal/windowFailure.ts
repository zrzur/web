import { isPartLoadError } from "../common/lib/lazyPart";

/**
 * Did the window's own part fail to download, so that it never drew? Only
 * then is the window taken off the list. A part nested inside an open
 * window is caught inside it instead: the insights page, the sound library
 * and the editor each have their own PageBoundary (the rest of the window
 * and what was typed stay), and the dialog body and the settings page have
 * one each for any other part.
 */
export function windowNeverDrew(
  error: unknown,
  ownPart: (part: unknown) => boolean,
) {
  return isPartLoadError(error) && ownPart(error.part);
}
