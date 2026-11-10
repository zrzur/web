/**
 * Server insights: what the page asks for and how it turns the answer into
 * totals and bar heights. Pure, so it is tested without a browser.
 */

export type Range = 7 | 30 | 90;
export const RANGES: Range[] = [7, 30, 90];

/** One day as the API sends it */
export type InsightsDay = {
  day: string;
  joins: number;
  leaves: number;
  members: number;
  messages: number;
  active_members: number;
  voice_minutes: number;
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

/** Sum of a series over the range */
export function total(rows: InsightsDay[], series: InsightsSeries) {
  let sum = 0;
  for (const row of rows) sum += row[series];
  return sum;
}

/** Average per day, rounded */
export function average(rows: InsightsDay[], series: InsightsSeries) {
  return rows.length ? Math.round(total(rows, series) / rows.length) : 0;
}

/**
 * Bar heights in percent of the tallest day (0 stays 0, any count shows at
 * least a sliver so it is not mistaken for none). With `fromMin`, the
 * lowest day is the baseline, for totals that barely move (members).
 */
export function barHeights(values: number[], fromMin = false): number[] {
  if (!values.length) return [];
  const max = Math.max(...values);
  const min = fromMin ? Math.min(...values) : 0;
  const span = max - min;
  return values.map((value) => {
    if (span <= 0) return value > 0 ? (fromMin ? 60 : 100) : 0;
    const height = ((value - min) / span) * 100;
    if (fromMin) return Math.round(20 + height * 0.8);
    return value > 0 ? Math.max(4, Math.round(height)) : 0;
  });
}

/** Whether anything at all was counted in the range */
export function hasActivity(rows: InsightsDay[]) {
  return rows.some(
    (row) =>
      row.joins ||
      row.leaves ||
      row.messages ||
      row.active_members ||
      row.voice_minutes,
  );
}

/** Shares of the joins by source, in percent, rounded to whole numbers */
export function shares(counts: number[]): number[] {
  const sum = counts.reduce((a, b) => a + b, 0);
  return counts.map((n) => (sum ? Math.round((n / sum) * 100) : 0));
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
