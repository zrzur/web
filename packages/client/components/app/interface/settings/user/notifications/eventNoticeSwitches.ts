/**
 * A person's switches for the notices of events. They are kept with the
 * account (the synced setting `event_notices`), because the server reads
 * them when it sends a notice to the person's phone.
 */
export const EVENT_NOTICES_KEY = "event_notices";

export const EVENT_NOTICE_KINDS = [
  "reminders",
  "changes",
  "invitations",
  "seats",
] as const;
export type EventNoticeKind = (typeof EVENT_NOTICE_KINDS)[number];
export type EventNoticeSwitches = Record<EventNoticeKind, boolean>;

/** Everything is on until the person switches it off */
export function parseEventNotices(text: string | undefined): EventNoticeSwitches {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = text ? JSON.parse(text) : undefined;
    if (value && typeof value === "object" && !Array.isArray(value))
      stored = value as Record<string, unknown>;
  } catch {
    /* not JSON: nothing is off */
  }
  return Object.fromEntries(
    EVENT_NOTICE_KINDS.map((kind) => [kind, stored[kind] !== false]),
  ) as EventNoticeSwitches;
}

/** Only what is off is written */
export function serializeEventNotices(switches: EventNoticeSwitches): string {
  return JSON.stringify(
    Object.fromEntries(
      EVENT_NOTICE_KINDS.filter((kind) => !switches[kind]).map((kind) => [
        kind,
        false,
      ]),
    ),
  );
}
