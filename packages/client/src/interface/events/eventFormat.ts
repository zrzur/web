import type { API } from "@zrzur/sdk/solid";

import { shortcutFor } from "../../../components/keybinds/active";

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

/** The day of an event for its date chip: "20" and "Nov" */
export function eventDay(
  startsAt: string,
  locale: string,
  timeZone?: string,
): { day: string; month: string } {
  const zone = timeZone ? { timeZone } : {};
  const start = new Date(startsAt);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale || "en", {
      numberingSystem: "latn",
      ...zone,
      ...options,
    }).format(start);
  return { day: part({ day: "numeric" }), month: part({ month: "short" }) };
}

/** The weekday an event starts on, as "Saturday" */
export function eventWeekday(
  startsAt: string,
  locale: string,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale || "en", {
    weekday: "long",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(startsAt));
}

/** The hours of an event, as "21:00 – 23:30" (the start alone without an end) */
export function eventTimes(
  event: Pick<ServerEvent, "starts_at" | "ends_at">,
  locale: string,
  hour12?: boolean,
  timeZone?: string,
): string {
  const format = new Intl.DateTimeFormat(locale || "en", {
    numberingSystem: "latn",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
    ...(hour12 === undefined ? {} : { hour12 }),
  });
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : undefined;
  return end && end > start
    ? format.formatRange(start, end)
    : format.format(start);
}

/** A short start for a card: "Fri 21:00" */
export function eventStartShort(
  startsAt: string,
  locale: string,
  hour12?: boolean,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale || "en", {
    numberingSystem: "latn",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
    ...(hour12 === undefined ? {} : { hour12 }),
  }).format(new Date(startsAt));
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
 * browser uses Ctrl+Shift+9. The person can change it in Ctrl+/.
 * @param mac Whether Command takes the place of Ctrl
 */
export function isEventsShortcut(
  event: Pick<
    KeyboardEvent,
    "code" | "altKey" | "shiftKey" | "ctrlKey" | "metaKey"
  > & { key?: string },
  mac: boolean,
): boolean {
  return shortcutFor(event, mac) === "open_events";
}

/**
 * The plain keys of the events screens: N plans a new event on the list, and
 * on an event's page G, M and X answer Going, Maybe and Can't go. By physical
 * key, so they are the same on an Arabic or German layout; never with a
 * modifier, which belongs to the browser and the app's other shortcuts.
 */
export function eventKey(
  event: Pick<
    KeyboardEvent,
    "code" | "altKey" | "shiftKey" | "ctrlKey" | "metaKey" | "repeat"
  >,
): "new" | "Going" | "Maybe" | "NotGoing" | undefined {
  if (
    event.altKey ||
    event.shiftKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.repeat
  )
    return undefined;
  switch (event.code) {
    case "KeyN":
      return "new";
    case "KeyG":
      return "Going";
    case "KeyM":
      return "Maybe";
    case "KeyX":
      return "NotGoing";
  }
  return undefined;
}

/** The shortcut leaves text fields and open dialogs alone */
export function eventsShortcutAllowed(typing: boolean, modalOpen: boolean) {
  return !typing && !modalOpen;
}
