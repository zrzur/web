/**
 * What `GET /auth/session/all` returns. `last_seen` is new: the SDK's types
 * and its `Session` class do not have it until the API snapshot is
 * regenerated, and a server that has not been updated leaves it out.
 */
export type ListedSession = { _id: string; last_seen?: string };

/**
 * When each listed session was last used. Every listed id is a key, so this
 * also says which sessions the server still has.
 */
export function readLastUsed(
  sessions: ListedSession[],
): Map<string, Date | undefined> {
  return new Map(
    sessions.map((session) => {
      const time = session.last_seen ? new Date(session.last_seen) : undefined;
      return [session._id, time && !isNaN(+time) ? time : undefined];
    }),
  );
}

/**
 * Most recently used first; a session with no known last use counts from
 * when it was created
 */
export function byLastUsed<T extends { id: string; createdAt: Date }>(
  sessions: T[],
  lastUsed: Map<string, Date | undefined>,
): T[] {
  const time = (session: T) => +(lastUsed.get(session.id) ?? session.createdAt);
  return [...sessions].sort((a, b) => time(b) - time(a));
}

/**
 * The server answers `UnknownUser` when a session is no longer there: it was
 * closed elsewhere or expired, which is what the person wanted
 */
export function isAlreadyClosed(error: unknown): boolean {
  return (error as { type?: string } | undefined)?.type === "UnknownUser";
}

/**
 * The server answers `InvalidSession` when this device's own session is
 * already gone: there is nothing left to log out of
 */
export function isAlreadySignedOut(error: unknown): boolean {
  return (error as { type?: string } | undefined)?.type === "InvalidSession";
}

/** Browser names as people know them; detect-browser gives lower-case ids */
const BROWSERS: Record<string, string> = {
  chrome: "Chrome",
  chromium: "Chromium",
  crios: "Chrome",
  edge: "Edge",
  "edge-chromium": "Edge",
  "edge-ios": "Edge",
  firefox: "Firefox",
  fxios: "Firefox",
  safari: "Safari",
  ios: "Safari",
  "ios-webview": "WebView",
  opera: "Opera",
  "opera-mini": "Opera Mini",
  samsung: "Samsung Internet",
  yandexbrowser: "Yandex",
  vivaldi: "Vivaldi",
  brave: "Brave",
  electron: "Zrzur",
};

const SYSTEMS: Record<string, string> = {
  "Mac OS": "macOS",
  "Android OS": "Android",
  "Chrome OS": "ChromeOS",
};

/** A browser id from detect-browser, as people write it */
export const browserName = (id: string) =>
  BROWSERS[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);

/** An OS name from detect-browser, as people write it */
export const systemName = (os: string) => SYSTEMS[os] ?? os;

/**
 * The browser and OS in a session name this app made at sign-in, such as
 * "Zrzur for Web (chrome on Mac OS)" in whatever language was in use then,
 * so the list can show every one in the current language. A name the person
 * chose themselves comes back undefined and is shown as it is.
 */
export function sessionDevice(
  name: string,
): { browser: string; os: string } | undefined {
  const found = /\(([a-z][\w-]*) \S+ ([^()]+)\)$/u.exec(name.trim());
  if (!found || name.length > 80) return undefined;
  return { browser: browserName(found[1]), os: systemName(found[2].trim()) };
}
