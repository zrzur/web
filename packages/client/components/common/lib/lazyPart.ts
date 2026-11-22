import { type Component, createComponent, lazy as solidLazy } from "solid-js";

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
 * A part that loaded is never downloaded twice, and once loaded it is drawn
 * at once, without a loading pass. It does not try again by itself: the
 * service worker already asks three times for a file (src/runtimeAssets.ts),
 * and a dialog that turned up seconds after the press, when the person had
 * already pressed again, opened twice. `retryMs` adds one quiet second try
 * for parts that must not fail (lazyRetry, during a call).
 *
 * A failure reaches the nearest ErrorBoundary as a `PartLoadError`, so a
 * boundary can tell "could not be downloaded" from a bug in the part.
 */

/** A part of the app could not be downloaded; `cause` is the import's error */
export class PartLoadError extends Error {
  constructor(cause: unknown) {
    super("A part of the app could not be loaded", { cause });
    this.name = "PartLoadError";
  }
}

/** Is this the failure of a part's download (and not a bug in the part)? */
export const isPartLoadError = (error: unknown): error is PartLoadError =>
  error instanceof PartLoadError;

/**
 * Called when one part failed to download twice in a row while the device
 * says it is online. Safari keeps a failed module in its module map, so
 * asking again can never work there; only a reload clears it. The app hands
 * this to the stale-build reload (src/staleBuild.ts), which reloads only
 * when the server answers, never during a call, and at most once in 30 s.
 */
let repeatedFailure: (() => void) | undefined;

/**
 * Listen for a part failing twice in a row while online
 * @returns Stops listening
 */
export function onRepeatedPartFailure(handler: () => void) {
  repeatedFailure = handler;
  return () => {
    if (repeatedFailure === handler) repeatedFailure = undefined;
  };
}

const online = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

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
  /** failed tries in a row while online */
  let failuresOnline = 0;
  /** the download under way, or the one that worked */
  let pending: Promise<{ default: T }> | undefined;

  const ask = () =>
    fn().catch((error: unknown) => {
      failuresOnline = online() ? failuresOnline + 1 : 0;
      if (failuresOnline >= 2) {
        failuresOnline = 0;
        repeatedFailure?.();
      }
      throw error;
    });

  const attempt = () =>
    retryMs === undefined
      ? ask()
      : ask().catch(
          () =>
            new Promise<{ default: T }>((resolve, reject) =>
              setTimeout(() => ask().then(resolve, reject), retryMs),
            ),
        );

  const load = (): Promise<{ default: T }> =>
    (pending ??= attempt().then(
      (module) => {
        failuresOnline = 0;
        // drawn straight from now on: no loading pass, no empty frame
        current = module.default;
        return module;
      },
      (error: unknown) => {
        // forget the failure: the next time the part opens it asks again
        pending = undefined;
        current = solidLazy(load);
        throw new PartLoadError(error);
      },
    ));

  let current: T = solidLazy(load) as unknown as T;

  // the part as rendered now: Solid's lazy while it is not here (a new copy
  // after a failure, so it starts over), the part itself once it is
  const part = ((props: Parameters<T>[0]) =>
    createComponent(current, props)) as T & {
    preload: () => Promise<{ default: T }>;
  };

  // Not Solid's own preload: it keeps a failed promise too. The router
  // (@solidjs/router) calls preload() on a route's component each time the
  // route is about to open, and drops the promise. After a failure each such
  // call asks again (fn() runs once more); after a success it is the same
  // promise, nothing is downloaded twice. The catch below only marks the
  // promise as handled, so a dropped one leaves no unhandled rejection;
  // whoever awaits it still gets the failure.
  part.preload = () => {
    const promise = load();
    promise.catch(() => undefined);
    return promise;
  };
  return part;
}
