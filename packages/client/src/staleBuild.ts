/**
 * After an update the server no longer has the old build's files. A page
 * opened before it then fails to load the next part it needs (sign-in, a
 * settings page, ...) and showed "Something went wrong". Instead, load the
 * new build once. A second failure soon after is a real problem: it stays.
 */

/** Session storage key: when this tab last reloaded for a missing file */
export const STALE_RELOAD_KEY = "zrzur:stale-build-reload";

/** Reload at most once in this many milliseconds */
export const STALE_RELOAD_GAP_MS = 30_000;

/** Whether to reload, given now and the last such reload (if any) */
export function shouldReloadForStaleBuild(
  now: number,
  last: string | null,
): boolean {
  const before = last ? Number(last) : NaN;
  return !Number.isFinite(before) || now - before > STALE_RELOAD_GAP_MS;
}

/** Who asks the page not to reload by itself right now (a call is on) */
const holds = new Set<symbol>();

/**
 * Keep the page from reloading by itself until the returned function runs.
 * A call holds it: a reload would drop the call (owner report 2026-11-15:
 * the soundboard reloaded the app). The part that failed to load reports
 * its own error instead.
 */
export function holdStaleReload(): () => void {
  const key = Symbol();
  holds.add(key);
  return () => void holds.delete(key);
}

/** Listen for Vite's failed dynamic imports and reload once */
export function watchForStaleBuild(target: Window = window) {
  target.addEventListener("vite:preloadError", (event) => {
    if (holds.size) {
      console.warn("[app] a part did not load; not reloading during a call", event);
      return;
    }
    let last: string | null = null;
    try {
      last = target.sessionStorage.getItem(STALE_RELOAD_KEY);
    } catch {
      // no storage: reloading once more is still better than a dead page
    }
    const now = Date.now();
    if (!shouldReloadForStaleBuild(now, last)) return;
    try {
      target.sessionStorage.setItem(STALE_RELOAD_KEY, String(now));
    } catch {
      // see above
    }
    // the error is handled here: no "Something went wrong" on the way out
    event.preventDefault();
    target.location.reload();
  });
}
