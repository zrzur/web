/**
 * Saved messages and message reminders: the parts that decide without
 * drawing. "Tonight" and "tomorrow morning" are worked out on the person's
 * own clock (the device's time zone), then sent to the server as one
 * instant, so a reminder set in Vienna for 20:00 arrives at 20:00 Vienna
 * time wherever the server is.
 */

/** When "tonight" is */
export const TONIGHT_HOUR = 20;
/** When "tomorrow morning" is */
export const MORNING_HOUR = 9;
/** "Tonight" is offered until this long before it */
const TONIGHT_LEAD_MS = 30 * 60_000;
/** Before this hour, "tomorrow morning" is the morning of the same day */
const NIGHT_OWL_HOUR = 4;

export type ReminderPreset = "20m" | "1h" | "tonight" | "morning";

export type PresetTime = {
  preset: ReminderPreset;
  at: Date;
  /** "morning" only: the morning is today's (the person is up past midnight) */
  sameDay?: boolean;
};

type ConfiguredClient =
  | { configuration?: { features?: object } | undefined }
  | null
  | undefined;

/**
 * Are saving and reminders on for this server
 * (`features.saved_reminders.enabled`)? Only a clear yes counts: unknown or
 * missing means off.
 */
export function savedRemindersEnabled(client: ConfiguredClient) {
  return (
    (client?.configuration?.features as { saved_reminders?: boolean })
      ?.saved_reminders === true
  );
}

/**
 * The ready-made times for "Remind me", on the device's own clock. Local
 * setters are used on purpose: across a daylight saving change "tomorrow
 * 09:00" stays 09:00 on the wall.
 */
export function presetTimes(now: Date): PresetTime[] {
  const list: PresetTime[] = [
    { preset: "20m", at: new Date(now.getTime() + 20 * 60_000) },
    { preset: "1h", at: new Date(now.getTime() + 60 * 60_000) },
  ];

  const tonight = new Date(now);
  tonight.setHours(TONIGHT_HOUR, 0, 0, 0);
  if (tonight.getTime() - now.getTime() >= TONIGHT_LEAD_MS)
    list.push({ preset: "tonight", at: tonight });

  const morning = new Date(now);
  const sameDay = now.getHours() < NIGHT_OWL_HOUR;
  if (!sameDay) morning.setDate(morning.getDate() + 1);
  morning.setHours(MORNING_HOUR, 0, 0, 0);
  list.push({ preset: "morning", at: morning, ...(sameDay && { sameDay }) });

  return list;
}

/** Furthest ahead a reminder can be set (the server checks its own setting) */
export const MAX_DAYS_AHEAD = 366;

export type DueProblem = "past" | "too-far";

/** What is wrong with a time the person picked, if anything */
export function dueProblem(
  at: Date | undefined,
  now: Date,
): DueProblem | undefined {
  if (!at || at.getTime() <= now.getTime()) return "past";
  if (at.getTime() > now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60_000)
    return "too-far";
}

/** The time first shown in "Pick a time": the next half hour, an hour on */
export function suggestedCustomTime(now: Date): Date {
  const at = new Date(now.getTime() + 60 * 60_000);
  const minutes = at.getMinutes();
  at.setMinutes(minutes === 0 ? 0 : minutes <= 30 ? 30 : 60, 0, 0);
  return at;
}

export type ReminderLike = { due_at: number; delivered_at?: number | null };

/** Waiting reminders soonest first; delivered ones newest first */
export function splitReminders<T extends ReminderLike>(list: T[]) {
  const waiting = list
    .filter((reminder) => reminder.delivered_at == null)
    .sort((a, b) => a.due_at - b.due_at);
  const due = list
    .filter((reminder) => reminder.delivered_at != null)
    .sort((a, b) => b.delivered_at! - a.delivered_at!);
  return { waiting, due };
}

/** Whether another reminder fits under the limit */
export function canAddReminder(waiting: number, max: number | undefined) {
  return max === undefined || waiting < max;
}
