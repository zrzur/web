import { type Component, Suspense, createComponent, lazy } from "solid-js";

/**
 * `lazy()` for parts that load during a call: a failed load is tried once
 * more (a short network drop), and if it still fails the fallback shows
 * instead of an error, so nothing reloads the page or ends the call.
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
  const Part = lazy(() => loadWithRetry(load, fallback, waitMs));
  const Contained = (props: Record<string, unknown>) =>
    createComponent(Suspense, {
      get children() {
        return createComponent(
          Part as Component<Record<string, unknown>>,
          props,
        );
      },
    });
  return Contained as unknown as T;
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
