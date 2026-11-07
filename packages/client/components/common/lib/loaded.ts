/**
 * Read a solid-query result's data without suspending.
 *
 * solid-query backs `data` with a resource: reading it while the query is
 * still pending suspends the nearest <Suspense>. Every channel sits inside
 * one (AgeGate), so a pending read anywhere in the chat — e.g. the GIF
 * picker's categories — detaches the whole message list for a frame, resets its
 * scroll position and makes it fetch history again. Once data exists the
 * library reads `latest`, which never suspends, so gate on that.
 */
export function loaded<T>(query: {
  readonly isSuccess: boolean;
  readonly data: T;
}) {
  return query.isSuccess ? query.data : undefined;
}
