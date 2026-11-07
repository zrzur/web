import type { Resource } from "solid-js";

/**
 * The value of a resource, or undefined while it has failed.
 *
 * Reading a failed Solid resource throws its error, and outside an
 * ErrorBoundary that ends as an uncaught page error ("Failed to fetch" when
 * the network drops). Read the failure with `resource.error` and show it;
 * read the value through this.
 */
export function resourceValue<T>(resource: Resource<T>): T | undefined {
  return resource.error ? undefined : resource();
}
