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

/**
 * A page of the app being opened (not a file, not another site). Paths with
 * a file ending are left to the browser: a missing file stays a real 404.
 */
export function isAppNavigation(
  request: { mode: string },
  url: URL,
  origin: string,
  scopePath: string,
) {
  return (
    request.mode === "navigate" &&
    url.origin === origin &&
    url.pathname.startsWith(scopePath) &&
    !/\.[a-z0-9]+$/i.test(url.pathname)
  );
}

/** Keys to remove so the cache stays within the limit, oldest first */
export function overLimit<T>(keys: readonly T[], limit = RUNTIME_CACHE_LIMIT) {
  return keys.slice(0, Math.max(0, keys.length - limit));
}
