/**
 * Files that are not in the precache: cached the first time they are used.
 * Their names carry a content hash, so a cached copy is never out of date.
 */
export const RUNTIME_CACHE = "zrzur-assets-v1";

/** Oldest entries go first; old builds leave files nobody asks for again */
export const RUNTIME_CACHE_LIMIT = 150;

export function isRuntimeAsset(url: URL, origin: string, scopePath: string) {
  return (
    url.origin === origin &&
    url.pathname.startsWith(`${scopePath}assets/`) &&
    /\.(js|css|woff2?)$/.test(url.pathname)
  );
}

/** Keys to remove so the cache stays within the limit, oldest first */
export function overLimit<T>(keys: readonly T[], limit = RUNTIME_CACHE_LIMIT) {
  return keys.slice(0, Math.max(0, keys.length - limit));
}
