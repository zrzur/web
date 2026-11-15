import { type Component, lazy } from "solid-js";

/**
 * `lazy()` for parts that load during a call: a failed load is tried once
 * more (a short network drop), and if it still fails the fallback shows
 * instead of an error, so nothing reloads the page or ends the call.
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
  return lazy(() => loadWithRetry(load, fallback, waitMs));
}

/** The loading rule of lazyRetry, on its own for tests */
export function loadWithRetry<T>(
  load: () => Promise<{ default: T }>,
  fallback: T,
  waitMs = 600,
): Promise<{ default: T }> {
  return load()
    .catch(
      () =>
        new Promise<{ default: T }>((resolve, reject) =>
          setTimeout(() => load().then(resolve, reject), waitMs),
        ),
    )
    .catch((error: unknown) => {
      console.warn("[app] a part could not be loaded", error);
      return { default: fallback };
    });
}
