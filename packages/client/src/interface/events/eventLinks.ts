import type { API } from "@zrzur/sdk/solid";

type ServerEvent = API.ServerEvent;

/**
 * Links of an event and its calendar file.
 *
 * The share link is `<invite origin>/e/<name>-<code>`; an invitation link is
 * `<invite origin>/e/join/<code>`. Without an invite origin both live on the
 * app's own address, where the same paths are routes.
 */

/** The base the short links are built on: the invite origin, else the app */
export function linkBase(
  appOrigin: string,
  inviteOrigin: string | undefined = import.meta.env.VITE_INVITE_ORIGIN as
    | string
    | undefined,
): string {
  const raw = inviteOrigin?.trim();
  if (raw) {
    try {
      const base = new URL(raw);
      if (base.protocol === "https:" || base.protocol === "http:")
        return base.href.replace(/\/$/, "");
    } catch {
      /* fall through to the app's address */
    }
  }
  return appOrigin.replace(/\/$/, "");
}

/** The part of a share link after `/e/` */
export function sharePath(link: { code: string; name?: string | null }) {
  return link.name ? `${link.name}-${link.code}` : link.code;
}

/** The share link of an event that has one */
export function shareLink(
  base: string,
  link: { code: string; name?: string | null },
) {
  // a name may be Arabic: kept readable, the browser encodes it on the wire
  return `${base}/e/${sharePath(link)}`;
}

/** An invitation link */
export function invitationLink(base: string, code: string) {
  return `${base}/e/join/${code}`;
}

/** Codes are 8 (share) or 16 (invitation) letters of this alphabet */
const RE_CODE = /^[2-9bcdfghjkmnpqrstvwxyz]+$/;

/** Whether the part after `/e/` can be a share link's path */
export function isSharePath(path: string) {
  const code = path.split("-").pop() ?? "";
  return path.length <= 60 && code.length === 8 && RE_CODE.test(code);
}

/** Whether a text can be an invitation code */
export function isInvitationCode(code: string) {
  return code.length === 16 && RE_CODE.test(code);
}

/** The reminders an organiser can choose, in minutes before the start */
export const REMINDER_CHOICES = [15, 60, 1440, 10080] as const;
/** What a new event starts with: a day and a quarter of an hour before */
export const DEFAULT_REMINDERS = [1440, 15];
/** Most reminders one event can have */
export const MAX_REMINDERS = 3;

/** "15 minutes", "1 hour", "2 days" in the person's language */
export function reminderSpan(minutes: number, locale: string): string {
  const [value, unit] =
    minutes % 1440 === 0
      ? [minutes / 1440, "day"]
      : minutes % 60 === 0
        ? [minutes / 60, "hour"]
        : [minutes, "minute"];
  try {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "long",
    }).format(value);
  } catch {
    return `${value} ${unit}`;
  }
}

// ---------------------------------------------------------------- calendar

/** Escape a text value of a calendar file (RFC 5545, 3.3.11) */
function icsText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lines of a calendar file are at most 75 bytes; longer ones are folded */
function fold(line: string) {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // a continued line starts with a space, which counts
    if (size + bytes > 75) {
      out.push(current);
      current = " ";
      size = 1;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join("\r\n");
}

function two(n: number) {
  return String(n).padStart(2, "0");
}

/** 20261120T180000Z */
function utcStamp(date: Date) {
  return (
    `${date.getUTCFullYear()}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}` +
    `T${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`
  );
}

/** 20261120T190000 as the clock shows it in a time zone; undefined if unknown */
function localStamp(date: Date, timeZone: string): string | undefined {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);
    const of = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? "00";
    return `${of("year")}${of("month")}${of("day")}T${of("hour")}${of("minute")}${of("second")}`;
  } catch {
    return undefined;
  }
}

const RRULE: Record<string, string> = {
  Daily: "FREQ=DAILY",
  Weekly: "FREQ=WEEKLY",
  EveryTwoWeeks: "FREQ=WEEKLY;INTERVAL=2",
  Monthly: "FREQ=MONTHLY",
};

/**
 * The event as a calendar file (.ics) that phone and desktop calendars
 * import. A repeating event keeps its local time in the organiser's time
 * zone, as the server does; nothing about who comes is in the file.
 * @param event The event
 * @param place Where it is, in words (a channel's name or the outside place)
 * @param url A link that opens the event
 * @param now When the file is made
 */
export function eventIcs(
  event: Pick<
    ServerEvent,
    | "_id"
    | "title"
    | "description"
    | "starts_at"
    | "ends_at"
    | "repeat"
    | "status"
    | "time_zone"
  >,
  place: string | undefined,
  url: string,
  now = new Date(),
): string {
  const start = new Date(event.starts_at);
  // calendars want an end: without one, an hour
  const end = event.ends_at
    ? new Date(event.ends_at)
    : new Date(start.getTime() + 3600_000);
  const rule = event.repeat ? RRULE[event.repeat] : undefined;
  const zone = rule ? event.time_zone : undefined;
  const localStart = zone ? localStamp(start, zone) : undefined;
  const localEnd = zone ? localStamp(end, zone) : undefined;
  const local = !!(zone && localStart && localEnd);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zrzur//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event._id}@zrzur`,
    `DTSTAMP:${utcStamp(now)}`,
    local ? `DTSTART;TZID=${zone}:${localStart}` : `DTSTART:${utcStamp(start)}`,
    local ? `DTEND;TZID=${zone}:${localEnd}` : `DTEND:${utcStamp(end)}`,
    `SUMMARY:${icsText(event.title)}`,
  ];
  const description = [event.description?.trim(), url]
    .filter(Boolean)
    .join("\n\n");
  lines.push(`DESCRIPTION:${icsText(description)}`);
  if (place) lines.push(`LOCATION:${icsText(place)}`);
  lines.push(`URL:${url}`);
  if (rule) lines.push(`RRULE:${rule}`);
  if (event.status === "Cancelled") lines.push("STATUS:CANCELLED");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A file name a calendar file can have on every system */
export function icsFileName(title: string) {
  const clean = title
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${clean || "event"}.ics`;
}
