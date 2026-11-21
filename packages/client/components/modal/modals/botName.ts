/**
 * A bot's name, as the server takes it (`RE_BOT_NAME`): words of letters,
 * numbers and `_ . -`, one space between words, 2 to 32 characters. With a
 * space it is the bot's display name ("Liro Bot") and its username has `_`
 * for the spaces ("Liro_Bot").
 */
// \p{Nd}, not \d: in JavaScript \d is 0-9 only, while the server's \d
// takes every decimal digit (Arabic-Indic ٠-٩ too)
export const BOT_NAME = /^(\p{L}|\p{Nd}|[_.-])+( (\p{L}|\p{Nd}|[_.-])+)*$/u;

export const BOT_NAME_MIN = 2;
export const BOT_NAME_MAX = 32;

/** What is wrong with a name typed so far, if anything (empty is no problem yet) */
export type BotNameProblem = "length" | "space" | "character";

export function botNameProblem(name: string): BotNameProblem | undefined {
  if (!name) return undefined;
  const length = [...name].length;
  if (length < BOT_NAME_MIN || length > BOT_NAME_MAX) return "length";
  if (/^\s|\s$|\s\s/.test(name)) return "space";
  if (!BOT_NAME.test(name)) return "character";
  return undefined;
}

/** Whether an API error is the server refusing the name's format */
export function isBotNameFormatError(error: unknown): boolean {
  const fields = (error as { type?: string; fields?: unknown } | undefined)
    ?.fields;
  return (
    (error as { type?: string } | undefined)?.type === "FailedValidation" &&
    Array.isArray(fields) &&
    fields.some(
      (field: { field?: string; rule?: string }) =>
        field?.field === "name" && field?.rule === "format",
    )
  );
}
