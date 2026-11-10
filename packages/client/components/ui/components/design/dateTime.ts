/**
 * Calendar and clock arithmetic for DateTimeField, in the person's own time
 * zone (local dates). No library: a month grid, day steps and 15-minute
 * time slots are all this needs.
 */

/** Minutes between two time choices */
export const TIME_STEP = 15;

/** Midnight of the same local day */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The same local time, `days` later (or earlier) */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** The same day `months` later, or the last day of a shorter month */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(date.getDate(), last));
  target.setHours(date.getHours(), date.getMinutes(), 0, 0);
  return target;
}

/** Whether two dates fall on the same local day */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * First day of the week where this language is mostly spoken: Saturday for
 * Arabic, Sunday for English and Chinese, Monday elsewhere (0 = Sunday)
 */
export function weekStartFor(locale: string): number {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  if (language === "ar") return 6;
  if (language === "en" || language === "zh" || language === "ja") return 0;
  return 1;
}

/**
 * The days shown for a month: six full weeks starting on `weekStart`, so
 * the grid never changes height
 */
export function monthGrid(
  year: number,
  month: number,
  weekStart: number,
): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

/** Minutes after local midnight */
export function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** A local day at a number of minutes after its midnight */
export function atMinutes(day: Date, minutes: number): Date {
  const date = startOfDay(day);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

/** The next time on the step grid at or after `date` */
export function roundUp(date: Date, step = TIME_STEP): Date {
  const exact = date.getSeconds() === 0 && date.getMilliseconds() === 0;
  const minutes = minutesOf(date) + (exact ? 0 : 1);
  const next = startOfDay(date);
  // past midnight rolls over to the next day by itself
  next.setMinutes(Math.ceil(minutes / step) * step);
  return next;
}

/** Every time choice of a day, in minutes after midnight */
export function timeSlots(step = TIME_STEP): number[] {
  return Array.from({ length: (24 * 60) / step }, (_, index) => index * step);
}

/**
 * Formatters in the app's language with Latin digits (as everywhere else in
 * Zrzur) and the person's 12 or 24 hour choice
 */
export function dateFormats(locale: string, hour12?: boolean) {
  const base = { numberingSystem: "latn" } as const;
  const lang = locale || "en";
  return {
    day: new Intl.DateTimeFormat(lang, {
      ...base,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    longDay: new Intl.DateTimeFormat(lang, {
      ...base,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    month: new Intl.DateTimeFormat(lang, {
      ...base,
      month: "long",
      year: "numeric",
    }),
    weekday: new Intl.DateTimeFormat(lang, { ...base, weekday: "narrow" }),
    weekdayLong: new Intl.DateTimeFormat(lang, { ...base, weekday: "long" }),
    dayNumber: new Intl.DateTimeFormat(lang, { ...base, day: "numeric" }),
    time: new Intl.DateTimeFormat(lang, {
      ...base,
      hour: "numeric",
      minute: "2-digit",
      ...(hour12 === undefined ? {} : { hour12 }),
    }),
  };
}

/** Whether a dayjs-style time format (the person's setting) uses 12 hours */
export function hour12From(timeFormat?: string): boolean | undefined {
  if (!timeFormat) return undefined;
  return /h|A|a/.test(timeFormat);
}
