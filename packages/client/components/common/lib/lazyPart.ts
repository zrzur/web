import { type Component, lazy as solidLazy } from "solid-js";

/**
 * Parts of the app that load the first time they are opened (dialogs,
 * sheets, settings pages, profile cards), like Solid's `lazy`, but a
 * download that failed is asked for again.
 *
 * Solid's `lazy` keeps the first promise it gets, also a failed one. On a
 * phone the network is often gone for a moment (the installed app coming
 * back from the background, a switch between Wi-Fi and mobile data): the
 * first press of a button then failed to fetch its part, and from then on
 * that button did nothing at all, however good the connection was, until
 * the page was reloaded. In the installed app there is no reload, so it
 * had to be closed and opened again (user report 2026-11-22, bug #3). The
 * stale-build check (src/staleBuild.ts) rightly does not reload for a
 * network failure, so nothing ever recovered.
 *
 * Now a failed download is tried once more after a moment (or once the
 * device is back online), and if that fails too the part forgets it: the
 * next press asks again. A part that loaded is never downloaded twice.
 */

/** Wait before the second try at a part that failed to download */
export const LAZY_RETRY_MS = 1000;

/** Offline: wait at most this long for the connection before trying again */
export const LAZY_OFFLINE_WAIT_MS = 8000;

/** Resolve after `ms`, or as soon as the device is back online when offline */
function beforeRetry(ms: number) {
  return new Promise<void>((resolve) => {
    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener("online", done);
      resolve();
    };
    const timer = setTimeout(
      done,
      offline ? Math.max(ms, LAZY_OFFLINE_WAIT_MS) : ms,
    );
    if (offline) window.addEventListener("online", done);
  });
}

/**
 * @param fn The dynamic import
 * @param retryMs Pause before the second try
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazy<T extends Component<any>>(
  fn: () => Promise<{ default: T }>,
  retryMs = LAZY_RETRY_MS,
): T & { preload: () => Promise<{ default: T }> } {
  const load = (): Promise<{ default: T }> =>
    fn()
      .catch(() => beforeRetry(retryMs).then(fn))
      .catch((error) => {
        // forget the failure: the next time the part opens it asks again
        current = solidLazy(load);
        throw error;
      });

  let current = solidLazy(load);

  // the part as rendered now: a new copy after a failure, so it starts over
  const part = ((props: Parameters<T>[0]) => current(props)) as T & {
    preload: () => Promise<{ default: T }>;
  };
  // not Solid's own preload: it keeps a failed promise too, and leaves a
  // second, unhandled copy of the failure behind
  part.preload = () =>
    load().then((module) => {
      current = solidLazy(() => Promise.resolve(module));
      return module;
    });
  return part;
}
