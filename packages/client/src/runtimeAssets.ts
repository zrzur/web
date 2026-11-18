/**
 * Files that are not in the precache: cached the first time they are used.
 * Their names carry a content hash, so a cached copy is never out of date.
 */
export const RUNTIME_CACHE = "zrzur-assets-v1";

/** Oldest entries go first; old builds leave files nobody asks for again */
export const RUNTIME_CACHE_LIMIT = 400;

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

/** Waits before each try at a file: at once, then twice more */
export const ASSET_RETRY_WAITS_MS = [0, 400, 1200] as const;

/**
 * Ask for a file up to three times. A phone's network drops single requests;
 * one lost request for a part of the app must not look like a failure to the
 * page (owner report 2026-11-18). A plain "not found" is an answer and is
 * returned at once; a server error or no answer is tried again.
 */
export async function fetchWithRetry<T extends { status: number }>(
  ask: () => Promise<T>,
  waits: readonly number[] = ASSET_RETRY_WAITS_MS,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((done) => setTimeout(done, ms)),
): Promise<T> {
  let answer: T | undefined;
  let failure: unknown;
  for (const wait of waits) {
    if (wait) await sleep(wait);
    try {
      answer = await ask();
      if (answer.status < 500) return answer;
    } catch (error) {
      failure = error;
    }
  }
  if (answer) return answer;
  throw failure;
}

/** The app's own pictures (default avatars, the logo, design art), kept the first time they are shown */
export const IMAGE_CACHE = "zrzur-images-v1";

/** Pictures kept; the oldest go first */
export const IMAGE_CACHE_LIMIT = 300;

/**
 * A picture that belongs to the app itself: asked for as an image, from the
 * app's own address. What people upload (avatars, attachments) lives on the
 * media server, another address, and is never kept by the worker.
 */
export function isRuntimeImage(
  request: { destination: string },
  url: URL,
  origin: string,
  scopePath: string,
) {
  return (
    request.destination === "image" &&
    url.origin === origin &&
    url.pathname.startsWith(scopePath) &&
    /\.(svg|png|webp|jpe?g|gif|ico|avif)$/i.test(url.pathname)
  );
}
