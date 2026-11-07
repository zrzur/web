/**
 * Rules behind the month and year of birth field. They only catch typos
 * and impossible dates, the same way the server's parser does; the minimum
 * age is never checked here (the server decides that).
 */

/** Oldest age accepted, matching the server's limit (a typo guard, not an age rule) */
export const OLDEST_AGE = 120;

/**
 * Keep only digits (Western, Arabic-Indic and Persian), at most 4
 * @param value What was typed or pasted
 */
export function yearDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .slice(0, 4);
}

/**
 * What is wrong with a year and month of birth, if anything
 * @param year Year as typed (digits)
 * @param month 1-12, or 0 when not chosen yet
 * @param now Today
 * @returns "format" for anything but 4 digits, "range" for the future or
 *   older than the server accepts, undefined when fine or still empty
 */
export function birthDateProblem(
  year: string,
  month: number,
  now: Date,
): "format" | "range" | undefined {
  if (!year) return;
  if (!/^\d{4}$/.test(year)) return "format";

  const value = Number(year);
  const thisYear = now.getFullYear();
  if (
    value > thisYear ||
    thisYear - value > OLDEST_AGE ||
    (value === thisYear && month > now.getMonth() + 1)
  )
    return "range";
}

/**
 * Month picked by type-ahead: letters typed in quick succession match the
 * start of a month name; one letter repeated cycles through the months
 * starting with it
 * @param names Month names in the UI language (12)
 * @param typed Letters typed so far (lower case)
 * @param current Highlighted or chosen month (0-11)
 * @returns Index of the match, or undefined
 */
export function matchMonth(names: string[], typed: string, current: number) {
  const lower = names.map((name) => name.toLocaleLowerCase());
  const repeat = typed.length > 1 && [...typed].every((c) => c === typed[0]);
  const needle = repeat ? typed[0] : typed;
  // a new search starts after the current month, a longer one includes it
  const first = repeat || typed.length === 1 ? 1 : 0;
  for (let step = first; step <= 12; step++) {
    const index = (current + step) % 12;
    if (lower[index].startsWith(needle)) return index;
  }
  return undefined;
}
