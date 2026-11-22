/**
 * Rich presence, the parts without UI: which activities to show, the timer
 * text and which pictures may load. Kept pure for unit tests.
 */

export type ActivityKind =
  | "Playing"
  | "Listening"
  | "Watching"
  | "Streaming"
  | "Competing"
  | "Using";

export type ActivitySource = "Rpc" | "Desktop" | "Steam";

/** One activity as the API sends it */
export type Activity = {
  source: ActivitySource;
  type: ActivityKind;
  name: string;
  details?: string | null;
  state?: string | null;
  started_at?: string | null;
  ends_at?: string | null;
  application_id?: string | null;
  large_image?: string | null;
  large_text?: string | null;
  small_image?: string | null;
  small_text?: string | null;
  buttons?: { label: string; url: string }[];
};

const ORDER: ActivitySource[] = ["Rpc", "Desktop", "Steam"];

/**
 * What to show: the main activity first (an app's own report, then what the
 * desktop saw, then Steam), and one entry per name (a game that reports
 * itself and is also seen running shows once, with the app's details).
 */
export function shownActivities(
  activities: readonly Activity[] | undefined,
): Activity[] {
  const sorted = [...(activities ?? [])].sort(
    (a, b) => ORDER.indexOf(a.source) - ORDER.indexOf(b.source),
  );
  const seen = new Set<string>();
  return sorted.filter((activity) => {
    const key = activity.name.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * When an activity began (or ends), in the reader's own words from the
 * browser: "12 minutes ago", "قبل 12 دقيقة", "vor 12 Minuten"; "in 3
 * minutes" for an end. Seconds under a minute, then minutes, hours, days.
 * `undefined` without a time, or for an end already past.
 */
export function relativeTime(
  iso: string | null | undefined,
  now: number,
  locale: string,
  future = false,
): string | undefined {
  if (!iso) return undefined;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return undefined;
  // a clock a little ahead of the server's still reads "now"
  let seconds = Math.round((at - now) / 1000);
  if (future) {
    if (seconds <= 0) return undefined;
  } else {
    seconds = Math.min(0, seconds);
  }
  const size = Math.abs(seconds);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    size < 60
      ? [seconds, "second"]
      : size < 3600
        ? [Math.trunc(seconds / 60), "minute"]
        : size < 86400
          ? [Math.trunc(seconds / 3600), "hour"]
          : [Math.trunc(seconds / 86400), "day"];
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      value,
      unit,
    );
  } catch {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      value,
      unit,
    );
  }
}

/**
 * A picture loads only from Zrzur's own file server or proxy; the server
 * already makes sure of that, and this checks again before the browser
 * asks for anything.
 */
export function ownPicture(
  url: string | null | undefined,
  hosts: (string | undefined)[],
): string | undefined {
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  for (const host of hosts) {
    if (!host) continue;
    try {
      const own = new URL(host);
      if (parsed.origin === own.origin && parsed.protocol === own.protocol)
        return url;
    } catch {
      // a host that is not an address never matches
    }
  }
  return undefined;
}

/** A button link the warning may open: `https://` only */
export function safeButtonUrl(url: string): URL | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

/** The icon for a kind (names from the app's icon registry) */
export function activityIcon(kind: ActivityKind): string {
  switch (kind) {
    case "Listening":
      return "music_note";
    case "Watching":
      return "visibility";
    case "Streaming":
      return "videocam";
    case "Competing":
      return "workspace_premium";
    case "Using":
      return "desktop_windows";
    default:
      return "sports_esports";
  }
}
