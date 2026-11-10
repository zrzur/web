/**
 * Server insights: what the page asks for and how it turns the answer into
 * totals and bar heights. Pure, so it is tested without a browser.
 */

export type Range = 7 | 30 | 90;
export const RANGES: Range[] = [7, 30, 90];

/** One day as the API sends it */
export type InsightsDay = {
  day: string;
  /** null: 1 to 4 ("fewer than 5") */
  joins?: number | null;
  /** null: 1 to 4 ("fewer than 5") */
  leaves?: number | null;
  members: number;
  /** null: 1 to 4 ("fewer than 5") */
  messages?: number | null;
  /** null: 1 to 4 ("fewer than 5") */
  active_members?: number | null;
  /** null: 1 to 4 ("fewer than 5") */
  voice_minutes?: number | null;
};

export type InsightsSeries = Exclude<keyof InsightsDay, "day">;

/** The viewer's time zone, so days start at their midnight */
export function viewerTimeZone(): { time_zone?: string; utc_offset: number } {
  let zone: string | undefined;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    zone = undefined;
  }
  // east of UTC is positive (getTimezoneOffset is the other way round)
  const offset = -new Date().getTimezoneOffset();
  return { time_zone: zone, utc_offset: offset === 0 ? 0 : offset };
}

/** Height of a day with 1 to 4 ("fewer than 5"): a small bar, never 0 */
export const FEW = 6;

/** Average per day of a total, rounded */
export function perDay(sum: number, days: number) {
  return days ? Math.round(sum / days) : 0;
}

/**
 * Bar heights in percent of the tallest day (0 stays 0, any count shows at
 * least a sliver so it is not mistaken for none). With `fromMin`, the
 * lowest day is the baseline, for totals that barely move (members).
 */
export function barHeights(
  values: (number | null | undefined)[],
  fromMin = false,
): number[] {
  if (!values.length) return [];
  const known = values.map((value) => value ?? 0);
  const max = Math.max(...known);
  const min = fromMin ? Math.min(...known) : 0;
  const span = max - min;
  return values.map((raw) => {
    // a hidden small number: as low as the smallest real bar
    if (raw === null) return FEW;
    const value = raw ?? 0;
    if (span <= 0) return value > 0 ? (fromMin ? 60 : 100) : 0;
    const height = ((value - min) / span) * 100;
    if (fromMin) return Math.round(20 + height * 0.8);
    return value > 0 ? Math.max(4, Math.round(height)) : 0;
  });
}

/** A count that is there: above 0, or hidden as 1 to 4 (null) */
const some = (value: number | null | undefined) =>
  value === null || (value ?? 0) > 0;

/** Whether anything at all was counted in the range */
export function hasActivity(rows: InsightsDay[]) {
  return rows.some(
    (row) =>
      some(row.joins) ||
      some(row.leaves) ||
      some(row.messages) ||
      some(row.active_members) ||
      some(row.voice_minutes),
  );
}

/**
 * Shares of the joins by source, in percent, rounded to whole numbers. A
 * hidden 1 to 4 (null) gets a sliver, so it is not drawn as none.
 */
export function shares(counts: (number | null)[]): number[] {
  const sum = counts.reduce<number>((a, b) => a + (b ?? 0), 0);
  return counts.map((n) =>
    n === null ? 3 : sum ? Math.round((n / sum) * 100) : 0,
  );
}

/**
 * A day label: the date of `YYYY-MM-DD` in the viewer's language. The date
 * is already in the viewer's time, so it is formatted as UTC (no shift).
 */
export function formatDay(day: string, locale: string, withYear = false) {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date);
}

/** Voice minutes as hours and minutes ("3 h 20 min") in the viewer's language */
export function formatMinutes(minutes: number, locale: string) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const unit = (value: number, unit: "hour" | "minute") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "narrow",
    }).format(value);
  if (!hours) return unit(rest, "minute");
  if (!rest) return unit(hours, "hour");
  return `${unit(hours, "hour")} ${unit(rest, "minute")}`;
}
