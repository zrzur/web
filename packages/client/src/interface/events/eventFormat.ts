import type { API } from "@zrzur/sdk/solid";

type ServerEvent = API.ServerEvent;

/** Starting within this many minutes counts as "soon" */
export const SOON_MINUTES = 60;

/**
 * When an event happens, in the person's language and time zone (named,
 * so nobody misreads it), with Latin digits like the rest of the app.
 * Same-day ranges keep the day once: "Tue, 1 Dec, 18:00 – 20:00 CET".
 */
export function eventWhen(
  event: Pick<ServerEvent, "starts_at" | "ends_at">,
  locale: string,
  hour12?: boolean,
  timeZone?: string,
): string {
  const options: Intl.DateTimeFormatOptions = {
    numberingSystem: "latn",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
    ...(hour12 === undefined ? {} : { hour12 }),
  };
  const format = new Intl.DateTimeFormat(locale || "en", options);
  const start = new Date(event.starts_at);
  if (!event.ends_at) return format.format(start);
  const end = new Date(event.ends_at);
  return typeof format.formatRange === "function"
    ? format.formatRange(start, end)
    : `${format.format(start)} – ${format.format(end)}`;
}

/** "in 3 hours", "tomorrow", "in 5 days" */
export function startsIn(
  startsAt: string,
  now: number,
  locale: string,
): string {
  const minutes = Math.round((Date.parse(startsAt) - now) / 60_000);
  const format = new Intl.RelativeTimeFormat(locale || "en", {
    numeric: "auto",
    numberingSystem: "latn",
  } as Intl.RelativeTimeFormatOptions);
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}

export type EventPhase = "live" | "soon" | "later" | "over";

/** Where an event is, for its badge and the banner */
export function eventPhase(
  event: Pick<ServerEvent, "status" | "starts_at">,
  now: number,
): EventPhase {
  if (event.status === "Active") return "live";
  if (event.status !== "Scheduled") return "over";
  const minutes = (Date.parse(event.starts_at) - now) / 60_000;
  return minutes <= SOON_MINUTES ? "soon" : "later";
}

/** The address that opens an event in the app */
export function eventLink(origin: string, serverId: string, eventId: string) {
  return `${origin}/server/${serverId}/events/${eventId}`;
}

/** Upcoming events counted on the Events row (happening ones included) */
export function upcomingCount(events: Pick<ServerEvent, "status">[]): number {
  return events.filter(
    (event) => event.status === "Scheduled" || event.status === "Active",
  ).length;
}

/** The events shortcut as plugin manifests write it (in RESERVED_KEYS) */
export const EVENTS_PLUGIN_KEYS = "Ctrl+Shift+9";

/**
 * Ctrl+Shift+9 (Command+Shift+9 on a Mac) opens the server's events. Matched
 * by key position (`event.code`), so it is the same on Arabic, German and
 * French layouts; next to Create poll (Ctrl+Shift+8). Never Alt+Shift
 * (Windows switches the layout with it) and never Ctrl+Alt (AltGr); no
 * browser uses Ctrl+Shift+9.
 * @param mac Whether Command takes the place of Ctrl
 */
export function isEventsShortcut(
  event: Pick<
    KeyboardEvent,
    "code" | "altKey" | "shiftKey" | "ctrlKey" | "metaKey"
  > & { key?: string },
  mac: boolean,
): boolean {
  const mod = mac ? event.metaKey : event.ctrlKey;
  const other = mac ? event.ctrlKey : event.metaKey;
  return (
    event.code === "Digit9" &&
    event.key !== "/" &&
    mod &&
    !other &&
    event.shiftKey &&
    !event.altKey
  );
}

/** The shortcut leaves text fields and open dialogs alone */
export function eventsShortcutAllowed(typing: boolean, modalOpen: boolean) {
  return !typing && !modalOpen;
}
