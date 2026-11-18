/**
 * The app's page, kept for opening without a connection.
 *
 * Opening the app asks the network first, always: a release is never served
 * from the device while the server can be reached. Only when the network
 * gives no answer (no connection, or none within a few seconds) is the page
 * kept from the last successful open used. Its scripts are the precached
 * shell of the same build, so the kept page and its files always belong
 * together: the cache is named after the build's files and a new worker
 * removes the older ones.
 *
 * Only the page is kept. Nothing with a session, a token or an answer of the
 * API ever passes through here (the worker does not handle those requests).
 */

/** Prefix of the cache that holds the kept page of one build */
export const SHELL_CACHE_PREFIX = "zrzur-shell-";

/** How long opening the app waits for the network before the kept page */
export const SHELL_TIMEOUT_MS = 3_000;

/** A short, stable name for a build from the list of its precached files */
export function buildKey(files: readonly string[]): string {
  let hash = 5381;
  for (const file of [...files].sort()) {
    for (let i = 0; i < file.length; i++)
      hash = ((hash << 5) + hash + file.charCodeAt(i)) | 0;
    hash = ((hash << 5) + hash + 10) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Cache names of other builds' pages, to delete */
export function staleShellCaches(names: readonly string[], current: string) {
  return names.filter(
    (name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== current,
  );
}

/** Whether an answer is the app's own page and may be kept */
export function isShellPage(response: {
  ok: boolean;
  status: number;
  redirected?: boolean;
  headers: { get(name: string): string | null };
}) {
  return (
    response.ok &&
    response.status === 200 &&
    !response.redirected &&
    (response.headers.get("content-type") ?? "").includes("text/html")
  );
}

export interface ShellStore<R> {
  get(): Promise<R | undefined>;
  put(response: R): Promise<void>;
}

/**
 * Answer a request to open the app.
 *
 * @param ask Fetch the page from the network
 * @param store The kept page of this build
 * @param copy Make a second copy of an answer (one is returned, one kept)
 * @param offline The page that says there is no connection
 */
export async function openApp<
  R extends Parameters<typeof isShellPage>[0],
>(options: {
  ask: () => Promise<R>;
  store: ShellStore<R>;
  copy: (response: R) => R;
  offline: () => Promise<R>;
  timeoutMs?: number;
  wait?: (ms: number) => Promise<void>;
}): Promise<R> {
  const { ask, store, copy, offline } = options;
  const wait =
    options.wait ?? ((ms) => new Promise<void>((done) => setTimeout(done, ms)));

  const keep = async (response: R) => {
    if (!isShellPage(response)) return;
    try {
      await store.put(copy(response));
    } catch {
      // the device is full or refuses storage: the app still opens online
    }
  };

  // the network's answer; kept for the next time whenever it arrives, also
  // after the kept page has already been shown
  const fromNetwork = ask().then(
    async (response) => {
      await keep(response);
      return response;
    },
    () => undefined,
  );

  const first = await Promise.race([
    fromNetwork,
    wait(options.timeoutMs ?? SHELL_TIMEOUT_MS).then(() => "slow" as const),
  ]);
  if (first && first !== "slow") return first;

  const kept = await store.get().catch(() => undefined);
  if (kept) return kept;

  // nothing kept yet: a slow network may still answer
  if (first === "slow") {
    const late = await fromNetwork;
    if (late) return late;
  }
  return offline();
}
