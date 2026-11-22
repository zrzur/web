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
 * Now a part that failed to download forgets it: the next press asks again.
 * A part that loaded is never downloaded twice. It does not try again by
 * itself: the service worker already asks three times for a file
 * (src/runtimeAssets.ts), and a dialog that turned up seconds after the
 * press, when the person had already pressed again, opened twice.
 * `retryMs` adds one quiet second try for parts that must not fail
 * (lazyRetry, during a call).
 */

/**
 * @param fn The dynamic import
 * @param retryMs When set, a failed download is tried once more after this
 *   many ms before it counts as failed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazy<T extends Component<any>>(
  fn: () => Promise<{ default: T }>,
  retryMs?: number,
): T & { preload: () => Promise<{ default: T }> } {
  const load = (): Promise<{ default: T }> =>
    (retryMs === undefined
      ? fn()
      : fn().catch(
          () =>
            new Promise<{ default: T }>((resolve, reject) =>
              setTimeout(() => fn().then(resolve, reject), retryMs),
            ),
        )
    ).catch((error) => {
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
