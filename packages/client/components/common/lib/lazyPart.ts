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
  constructor(
    cause: unknown,
    /** the part that failed (what `lazy()` returned) */
    readonly part?: unknown,
  ) {
    super("A part of the app could not be loaded", { cause });
    this.name = "PartLoadError";
  }
}

/** Is this the failure of a part's download (and not a bug in the part)? */
export const isPartLoadError = (error: unknown): error is PartLoadError =>
  error instanceof PartLoadError;

/**
 * The errors browsers give a dynamic import whose file did not arrive:
 * Chrome "Failed to fetch dynamically imported module", Safari "Importing a
 * module script failed.", Firefox "error loading dynamically imported
 * module". Anything else (a SyntaxError, a ReferenceError while the module
 * runs) is a bug in the code and must not be dressed up as a lost download.
 */
const DOWNLOAD_FAILED =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export const isDownloadFailure = (error: unknown) =>
  error instanceof TypeError && DOWNLOAD_FAILED.test(error.message);

/**
 * Called when one part failed to download twice in a row, each time when it
 * was opened (not preloaded), while the device says it is online. Safari keeps a failed module in its module map, so
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
  /**
   * Failed downloads in a row while online, counted only for a press or an
   * open (a person waited for the part): a preload (hover, focus, the
   * router getting a page ready) never counts, and a part's quiet second
   * try (retryMs) is one failure with its first, not two
   */
  let failuresOnline = 0;
  /** the download under way, or the one that worked */
  let pending: Promise<{ default: T }> | undefined;
  /** someone opened the part while the download under way runs */
  let opened = false;

  const attempt = () =>
    retryMs === undefined
      ? fn()
      : fn().catch(
          () =>
            new Promise<{ default: T }>((resolve, reject) =>
              setTimeout(() => fn().then(resolve, reject), retryMs),
            ),
        );

  const load = (byOpen: boolean): Promise<{ default: T }> => {
    if (byOpen) opened = true;
    return (pending ??= attempt().then(
      (module) => {
        failuresOnline = 0;
        opened = false;
        // drawn straight from now on: no loading pass, no empty frame
        current = module.default;
        return module;
      },
      (error: unknown) => {
        const counts = opened;
        opened = false;
        // forget the failure: the next time the part opens it asks again
        pending = undefined;
        current = solidLazy(() => load(true));
        // a bug in the code is not a lost download: as it was
        if (!isDownloadFailure(error)) throw error;
        if (counts) {
          failuresOnline = online() ? failuresOnline + 1 : 0;
          if (failuresOnline >= 2) {
            failuresOnline = 0;
            repeatedFailure?.();
          }
        }
        throw new PartLoadError(error, part);
      },
    ));
  };

  let current: T = solidLazy(() => load(true)) as unknown as T;

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
    const promise = load(false);
    promise.catch(() => undefined);
    return promise;
  };
  return part;
}
