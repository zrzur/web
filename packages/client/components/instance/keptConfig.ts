/**
 * The server's public configuration (`GET /` on the API: addresses of its
 * services, limits, which features are on), kept from the last visit so the
 * app can start without a connection. Nothing here is private or tied to an
 * account; the session is never part of it.
 */

const key = (api: string) => `zrzur:config:${api.replace(/\/+$/, "")}`;

/** Keep the configuration of this server */
export function keepConfig(
  api: string,
  configuration: unknown,
  storage: Pick<Storage, "setItem"> | undefined = safeStorage(),
) {
  if (!configuration || typeof configuration !== "object") return;
  try {
    storage?.setItem(key(api), JSON.stringify(configuration));
  } catch {
    // storage is full or blocked: the next offline start asks the network
  }
}

/** The configuration kept for this server, if any */
export function keptConfig<T>(
  api: string,
  storage: Pick<Storage, "getItem"> | undefined = safeStorage(),
): T | undefined {
  try {
    const text = storage?.getItem(key(api));
    const value = text ? (JSON.parse(text) as unknown) : undefined;
    return value && typeof value === "object" ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether a failed request got no answer at all (no connection, the server
 * cannot be reached), as opposed to an answer that says no.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  // an answer of the API carries a type; the early request names its status
  if ((error as { type?: unknown } | null)?.type) return false;
  if (/^configuration \d+/.test(text)) return false;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(
    text,
  );
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
