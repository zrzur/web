import { createSignal, onCleanup } from "solid-js";

import type { Dayjs } from "dayjs";

/**
 * `<t:SECONDS>` or `<t:SECONDS:FORMAT>` in a message: a moment shown in the
 * reader's own time zone and language. FORMAT is one letter:
 *
 * - `t` short time (16:20), `T` long time (16:20:30)
 * - `d` short date (20/04/2021), `D` long date (20 April 2021)
 * - `f` date and time (the default), `F` with the weekday
 * - `R` relative (in 2 hours, 3 days ago)
 */
export const TIMESTAMP_FORMATS = ["t", "T", "d", "D", "f", "F", "R"] as const;
export type TimestampFormat = (typeof TIMESTAMP_FORMATS)[number];

/** The largest moment a JavaScript date can hold, in seconds */
const MAX_SECONDS = 8_640_000_000_000 / 1000;

/** Seconds from a message, or undefined when they are not a real moment */
export function timestampSeconds(text: string): number | undefined {
  if (!/^[0-9]{1,16}$/.test(text)) return undefined;
  const seconds = Number(text);
  return Number.isSafeInteger(seconds) && seconds <= MAX_SECONDS
    ? seconds
    : undefined;
}

/** The format letter, or the default for a missing or unknown one */
export function timestampFormat(letter: string | undefined): TimestampFormat {
  return (TIMESTAMP_FORMATS as readonly string[]).includes(letter ?? "")
    ? (letter as TimestampFormat)
    : "f";
}

/** The text a timestamp shows, in the date's locale */
export function formatTimestamp(date: Dayjs, format: TimestampFormat): string {
  switch (format) {
    case "t":
      // localised formats follow the user's language and 12/24-hour choice
      return date.format("LT");
    case "T":
      return date.format("LTS");
    case "d":
      return date.format("L");
    case "D":
      return date.format("LL");
    case "F":
      return date.format("LLLL");
    case "R":
      return date.fromNow();
    default:
      return date.format("LLL");
  }
}

/** The full moment for the tooltip, in the reader's language */
export function timestampTitle(date: Dayjs): string {
  return date.format("LLLL");
}

/**
 * One clock for every relative timestamp on screen: it ticks every 30 s while
 * at least one is shown and stops when the last one goes away.
 */
const [tick, setTick] = createSignal(0);
let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/** Subscribe the calling component to the shared clock (call inside a root) */
export function useRelativeClock() {
  users += 1;
  if (!timer) timer = setInterval(() => setTick((n) => n + 1), 30_000);
  onCleanup(() => {
    users -= 1;
    if (users === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  });
  return tick;
}

/** For tests: whether the shared clock runs */
export function relativeClockRunning() {
  return timer !== undefined;
}
