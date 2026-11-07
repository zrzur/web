/**
 * Slash command options typed inline in the message box:
 * `/play game:Tic Tac Toe difficulty:hard`
 *
 * Each option starts with its name and a colon at the start of the text or
 * after white space, and its value runs to the next option.
 */
export type OptionSpan = {
  /** Option name as typed */
  name: string;
  /** Start of `name:` */
  from: number;
  /** End of `name:` (just after the colon) */
  nameEnd: number;
  /** Start of the value (leading spaces skipped) */
  valueFrom: number;
  /** End of the value (trailing spaces skipped) */
  valueTo: number;
  /** Where this option's text ends: the next option, or the end of the text */
  end: number;
  /** Value without surrounding white space */
  value: string;
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Find the options in `text` after `prefix` (the end of `/command sub `)
 * @param text Whole message box text
 * @param prefix Where options may start
 * @param names Option names that may appear
 */
export function parseCommandOptions(
  text: string,
  prefix: number,
  names: string[],
): OptionSpan[] {
  if (!names.length) return [];
  // longer names first, so `game` never shadows `game_mode`
  const alternatives = [...names]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|");
  const pattern = new RegExp(`(?<=^|\\s)(${alternatives}):`, "gu");

  const found: { name: string; from: number; nameEnd: number }[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const from = match.index!;
    if (from < prefix) continue;
    // a name given twice: only the first counts, the rest is value text
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    found.push({ name: match[1], from, nameEnd: from + match[0].length });
  }

  return found.map((span, index) => {
    const end = found[index + 1]?.from ?? text.length;
    const raw = text.slice(span.nameEnd, end);
    const lead = raw.length - raw.trimStart().length;
    const value = raw.trim();
    return {
      ...span,
      end,
      value,
      valueFrom: span.nameEnd + lead,
      valueTo: span.nameEnd + lead + value.length,
    };
  });
}

/**
 * The option the cursor is in: from its name up to where the next one starts
 * @param spans Parsed options
 * @param cursor Cursor position
 */
export function spanAtCursor(
  spans: OptionSpan[],
  cursor: number,
): OptionSpan | undefined {
  return spans.find((span) => cursor > span.from && cursor <= span.end);
}

/** Mention forms the message box shows as pills */
export const RE_USER_VALUE = /^<@([0-9A-HJKMNP-TV-Z]{26})>$/;
export const RE_ROLE_VALUE = /^<%([0-9A-HJKMNP-TV-Z]{26})>$/;
export const RE_CHANNEL_VALUE = /^<#([0-9A-HJKMNP-TV-Z]{26})>$/;
