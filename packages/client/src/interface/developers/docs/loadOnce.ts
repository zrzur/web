/**
 * Fetch something once per key and share the answer. A fetch that fails is
 * forgotten, so the next caller (Try again) fetches it anew instead of
 * getting the old failure forever.
 */
export function loadOnce<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  let pending = cache.get(key);
  if (!pending) {
    pending = load();
    cache.set(key, pending);
    pending.catch(() => {
      if (cache.get(key) === pending) cache.delete(key);
    });
  }
  return pending;
}
