import {
  type Component,
  ErrorBoundary,
  Suspense,
  createComponent,
} from "solid-js";

import { isPartLoadError, lazy } from "../../../common/lib/lazyPart";

/**
 * `lazy()` for parts that load during a call: a failed load is tried once
 * more (a short network drop), and if it still fails the fallback shows
 * instead of an error, so nothing reloads the page or ends the call. The
 * failure is not kept: the next time the part opens, its file is asked for
 * again (it used to stay the fallback, an empty panel, until the page was
 * reloaded; bug #3 of 2026-11-22, see common/lib/lazyPart.ts). Only a
 * failed download shows the fallback: an error of a part that loaded goes
 * up to the boundary above.
 *
 * The part waits inside its own loading boundary. Without one, a part that
 * is still loading (its file, or data it reads while it draws) hands the
 * wait to the nearest boundary above it, which is the whole app's: the app
 * left the screen for its first screen until the part was ready (owner
 * report 2026-11-17: "every time I press the soundboard the app refreshes").
 * While it waits, the part shows nothing and everything around it stays.
 *
 * @param load The dynamic import
 * @param fallback Shown when the part cannot be loaded
 * @param waitMs Pause before the second try
 */
export function lazyRetry<T extends Component<any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  load: () => Promise<{ default: T }>,
  fallback: T,
  waitMs = 600,
) {
  const Part = lazy(load, waitMs);
  const Contained = (props: Record<string, unknown>) =>
    createComponent(Suspense, {
      get children() {
        return createComponent(ErrorBoundary, {
          // only a failed download falls back; a bug in a part that did
          // load goes up to the boundary above, as it would without this
          fallback: (error: unknown) => {
            if (!isPartLoadError(error)) throw error;
            console.warn("[app] a part could not be loaded", error);
            return createComponent(
              fallback as Component<Record<string, unknown>>,
              props,
            );
          },
          get children() {
            return createComponent(
              Part as Component<Record<string, unknown>>,
              props,
            );
          },
        });
      },
    });
  return Contained as unknown as T;
}
