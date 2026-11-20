import type { Resource } from "solid-js";

/**
 * A resource's value without suspending. Reading `resource()` or
 * `resource.latest` before the first answer suspends up to the nearest
 * Suspense boundary: on the events pages that is the app's own one, so the
 * whole app showed its loading screen while the calendar's month loaded,
 * which looks like the page reloading (owner, 2026-11-20). This reads the
 * value only once there is one and is undefined before, and after an error.
 */
export function settled<T>(resource: Resource<T>): T | undefined {
  return resource.state === "ready" || resource.state === "refreshing"
    ? resource.latest
    : undefined;
}
