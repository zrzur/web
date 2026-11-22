/**
 * After an update the server no longer has the old build's files. A page
 * opened before it then fails to load the next part it needs (sign-in, a
 * settings page, ...) and showed "Something went wrong". Instead, load the
 * new build once. A second failure soon after is a real problem: it stays.
 *
 * Only a real update reloads the page. A part that fails to load for any
 * other reason (a phone's network dropping a request) never does: the page
 * stays, and the part that asked for the file tries again or says so (owner
 * report 2026-11-18: the app "refreshed by itself" when he opened tabs and
 * settings pages on a phone).
 */

import { onRepeatedPartFailure } from "../components/common/lib/lazyPart";

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

export interface StaleBuildOptions {
  /** Commit of the build this page runs; empty in development */
  runningCommit?: string;
  /**
   * Commit of the build the server has now, or undefined when it cannot be
   * read (no connection). Default: the app's /build.json, never from a cache.
   */
  serverCommit?: () => Promise<string | undefined>;
}

/** The commit named by the server's /build.json */
async function readServerCommit(target: Window): Promise<string | undefined> {
  try {
    const base = import.meta.env?.BASE_URL ?? "/";
    const response = await target.fetch(`${base}build.json`, {
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const commit = ((await response.json()) as { commit?: unknown }).commit;
    return typeof commit === "string" && commit ? commit : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Listen for Vite's failed dynamic imports. When the server has moved to
 * another build, reload once; otherwise leave the page alone.
 */
export function watchForStaleBuild(
  target: Window = window,
  options: StaleBuildOptions = {},
) {
  const running = options.runningCommit ?? "";
  const serverCommit = options.serverCommit ?? (() => readServerCommit(target));
  // known from an earlier failure: the next one reloads without the detour
  // through the failing part's own error
  let stale = false;

  const reload = (event?: Event) => {
    if (holds.size) {
      console.warn("[app] a part did not load; not reloading during a call");
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
    event?.preventDefault();
    target.location.reload();
  };

  // A part failed to download twice in a row while the device says it is
  // online (common/lib/lazyPart.ts). Safari keeps a failed module in its
  // module map, so asking again can never work there; a reload clears it.
  // Only when the server answers: with no connection a reload would show
  // the "no connection" page instead of the app (owner, 2026-11-18: no
  // reloads for network trouble). A call still holds it, and the 30 s gap
  // stops a loop.
  onRepeatedPartFailure(() => {
    if (holds.size) return;
    void serverCommit().then((commit) => {
      if (!commit) return;
      console.warn("[app] a part failed twice while online: reloading");
      reload();
    });
  });

  target.addEventListener("vite:preloadError", (event) => {
    if (holds.size) {
      console.warn(
        "[app] a part did not load; not reloading during a call",
        event,
      );
      return;
    }
    // a build that does not know its own commit cannot tell: as before
    if (stale || !running) return reload(event);

    // the same build is still on the server: this was the network, not an
    // update. The failure reaches the part that asked for the file.
    void serverCommit().then((commit) => {
      if (!commit || commit === running) {
        console.warn(
          "[app] a part did not load; the build is current, not reloading",
        );
        return;
      }
      stale = true;
      reload();
    });
  });
}
