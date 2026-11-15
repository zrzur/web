/** How long the page may stay before the sign-in page counts as not opened */
export const SIGN_IN_STUCK_AFTER_MS = 4000;

/**
 * Leave for a service's own sign-in page (Steam, Twitch, GitHub, Battle.net).
 *
 * Something can stop the navigation without an error: desktop 26.1.0-beta1
 * blocks every outside site, and nothing reaches this page. If the page is
 * still here and visible after `delay`, `onStuck` runs, so the card can give
 * its button back and say what to do.
 *
 * Only `pagehide` counts as leaving: `beforeunload` also fires for a
 * navigation that is blocked after it, so it proves nothing. A hidden page
 * (the sign-in opened elsewhere) is not stuck either.
 *
 * Returns a function that stops waiting.
 */
export function leaveForSignIn(
  url: string,
  onStuck: () => void,
  delay = SIGN_IN_STUCK_AFTER_MS,
): () => void {
  let left = false;
  const leaving = () => {
    left = true;
  };
  const stop = () => {
    clearTimeout(timer);
    window.removeEventListener("pagehide", leaving);
  };
  window.addEventListener("pagehide", leaving);
  const timer = setTimeout(() => {
    stop();
    if (!left && document.visibilityState !== "hidden") onStuck();
  }, delay);
  window.location.assign(url);
  return stop;
}
