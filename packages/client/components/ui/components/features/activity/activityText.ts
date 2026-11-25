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

/**
 * Percent-encode a query value exactly as the server does
 * (`util::activity::encode_query`): letters, digits and `-_.~` stay. The
 * proxy keeps one copy per address, so the page asks for the same address
 * the server put in an activity.
 */
export function encodeQuery(value: string): string {
  let out = "";
  for (const byte of new TextEncoder().encode(value)) {
    const c = String.fromCharCode(byte);
    out += /[A-Za-z0-9\-_.~]/.test(c)
      ? c
      : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

/**
 * An outside `https://` picture as Zrzur's image proxy serves it; nothing
 * without a proxy. The browser never asks the outside host itself.
 */
export function proxied(
  url: string | null | undefined,
  proxy: string | undefined,
): string | undefined {
  if (!url || !proxy) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username) return undefined;
  } catch {
    return undefined;
  }
  return `${proxy.replace(/\/+$/, "")}/proxy?url=${encodeQuery(url)}`;
}

/**
 * A program's own icon from the desktop app: a PNG, JPEG or WebP data
 * address only (never SVG, never a page)
 */
export function localIcon(url: string | null | undefined): string | undefined {
  return url && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url)
    ? url
    : undefined;
}

/** The first letter or digit of a name, for a tile without a picture */
export function tileLetter(name: string): string {
  for (const char of name) {
    if (/[\p{L}\p{N}]/u.test(char)) return char.toLocaleUpperCase().slice(0, 1);
  }
  return "?";
}

/**
 * The official page of a program the desktop app saw: its one `https://`
 * link (the desktop sends the site's name as the label). An app's own
 * buttons are shown as buttons instead.
 */
export function pageLink(
  activity: Activity,
): { url: URL; host: string } | undefined {
  if (activity.source !== "Desktop") return undefined;
  const first = activity.buttons?.[0];
  const url = first ? safeButtonUrl(first.url) : undefined;
  return url ? { url, host: url.hostname.replace(/^www\./, "") } : undefined;
}
