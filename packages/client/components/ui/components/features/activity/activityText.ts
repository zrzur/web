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

/** `m:ss`, or `h:mm:ss` from an hour on; nothing for a time ahead */
export function clock(ms: number): string | undefined {
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/** Time since it started, or `undefined` */
export function elapsedText(
  activity: Activity,
  now: number,
): string | undefined {
  if (!activity.started_at) return undefined;
  const start = Date.parse(activity.started_at);
  if (Number.isNaN(start)) return undefined;
  // a clock a little ahead of the server's still reads 0:00
  return clock(Math.max(0, now - start));
}

/** Time left until it ends, or `undefined` */
export function remainingText(
  activity: Activity,
  now: number,
): string | undefined {
  if (!activity.ends_at) return undefined;
  const end = Date.parse(activity.ends_at);
  if (Number.isNaN(end) || end <= now) return undefined;
  return clock(end - now);
}

/** Share of the time gone, 0 to 1, when both ends are known */
export function progress(activity: Activity, now: number): number | undefined {
  if (!activity.started_at || !activity.ends_at) return undefined;
  const start = Date.parse(activity.started_at);
  const end = Date.parse(activity.ends_at);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start)
    return undefined;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
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
