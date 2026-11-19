import type { API } from "@zrzur/sdk/solid";

type ServerEvent = API.ServerEvent;

/**
 * The month and week views of events: which days a view shows, and which
 * events fall on which day, by the clock of the person looking.
 */

export type CalendarView = "month" | "week";
/** Which places a list shows */
export type PlaceFilter = "any" | "Voice" | "Text" | "External";

/** The first day of the week where a language is spoken (0 is Sunday) */
export function weekStartsOn(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay?: number };
      getWeekInfo?: () => { firstDay?: number };
    };
    const first = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    // Intl counts Monday as 1 and Sunday as 7
    if (typeof first === "number") return first % 7;
  } catch {
    /* fall through */
  }
  const language = locale.split("-")[0];
  if (language === "ar") return 6;
  if (language === "en") return 0;
  return 1;
}

/** A day as a key: the local date, `2026-11-20` */
export function dayKey(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/** Midnight at the start of a local day */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The same local day `days` later (across daylight saving changes) */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The seven days of the week a date is in */
export function weekOf(date: Date, weekStart: number): Date[] {
  const back = (date.getDay() - weekStart + 7) % 7;
  const first = addDays(date, -back);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/** The weeks a month view shows: whole weeks that cover the month */
export function monthWeeks(date: Date, weekStart: number): Date[][] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  let week = weekOf(first, weekStart);
  while (week[0] <= last) {
    weeks.push(week);
    week = weekOf(addDays(week[0], 7), weekStart);
  }
  return weeks;
}

/** The days a view shows, and the time span to ask the server for */
export function calendarRange(
  view: CalendarView,
  anchor: Date,
  weekStart: number,
): { days: Date[]; from: Date; to: Date } {
  const days =
    view === "week"
      ? weekOf(anchor, weekStart)
      : monthWeeks(anchor, weekStart).flat();
  return { days, from: days[0], to: addDays(days[days.length - 1], 1) };
}

/** The view one step earlier or later, or back at today */
export function moveAnchor(
  view: CalendarView,
  anchor: Date,
  step: -1 | 1,
): Date {
  return view === "week"
    ? addDays(anchor, step * 7)
    : new Date(anchor.getFullYear(), anchor.getMonth() + step, 1);
}

/** Events by the local day they start on, each day soonest first */
export function eventsByDay<T extends Pick<ServerEvent, "starts_at">>(
  events: T[],
): Map<string, T[]> {
  const days = new Map<string, T[]>();
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  );
  for (const event of sorted) {
    const key = dayKey(new Date(event.starts_at));
    const list = days.get(key);
    if (list) list.push(event);
    else days.set(key, [event]);
  }
  return days;
}

/** "November 2026", or the span of a week: "16 – 22 Nov 2026" */
export function calendarTitle(
  view: CalendarView,
  anchor: Date,
  weekStart: number,
  locale: string,
): string {
  if (view === "month")
    return new Intl.DateTimeFormat(locale, {
      numberingSystem: "latn",
      month: "long",
      year: "numeric",
    }).format(anchor);
  const week = weekOf(anchor, weekStart);
  return new Intl.DateTimeFormat(locale, {
    numberingSystem: "latn",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatRange(week[0], week[6]);
}

/**
 * Whether an event matches what a person typed and the place they chose.
 * The words are looked for in the title and the description, in any order.
 */
export function eventMatches(
  event: Pick<ServerEvent, "title" | "description" | "place">,
  search: string,
  place: PlaceFilter,
): boolean {
  if (place !== "any" && event.place.type !== place) return false;
  const words = search.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = `${event.title} ${event.description ?? ""}`.toLocaleLowerCase();
  return words.every((word) => text.includes(word));
}
