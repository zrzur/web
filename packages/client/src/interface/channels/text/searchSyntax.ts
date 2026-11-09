/**
 * Message search syntax: plain words plus `key:value` filters, the same
 * English keywords in every language (the chips show localised labels).
 *
 *   from:alice  mentions:bob  has:image  before:2026-11-09  after:…
 *   during:…  in:general  pinned:true
 *
 * Values with spaces go in quotes: `in:"off topic"`. Dates are days in the
 * user's own time zone (YYYY-MM-DD, Arabic-Indic digits too) or message ids.
 */
import type { API } from "@zrzur/sdk/solid";

export const SEARCH_KEYS = [
  "from",
  "mentions",
  "has",
  "before",
  "after",
  "during",
  "in",
  "pinned",
] as const;
export type SearchKey = (typeof SEARCH_KEYS)[number];

export const HAS_VALUES = [
  "link",
  "file",
  "image",
  "video",
  "embed",
  "sound",
] as const;
export type HasValue = (typeof HAS_VALUES)[number];

export interface SearchToken {
  key: SearchKey;
  value: string;
  start: number;
  end: number;
}

export interface ParsedSearch {
  /** The words, filters taken out */
  words: string;
  tokens: SearchToken[];
}

/** Finds people and channels by the name typed */
export interface SearchResolver {
  /** User id for a name or username, case-insensitive */
  user(name: string): string | undefined;
  /** Channel id for a name, case-insensitive */
  channel(name: string): string | undefined;
  /** False in a conversation: `in:` needs a server (default true) */
  inServer?: boolean;
}

export type SearchProblemReason =
  | "unknown-user"
  | "unknown-channel"
  | "bad-date"
  | "bad-has"
  | "bad-pinned"
  | "one-only"
  | "too-many"
  | "no-server";

export interface SearchProblem {
  key: SearchKey;
  value: string;
  reason: SearchProblemReason;
}

export type SearchParams = Omit<
  API.DataMessageSearch,
  "include_users" | "sort" | "limit"
>;

export interface SearchRequest {
  params: SearchParams;
  /** `in:` was used: search the server, not this channel */
  serverWide: boolean;
  problems: SearchProblem[];
  /** Nothing to search for yet */
  empty: boolean;
  /** The words were longer than the server searches */
  truncated: boolean;
}

/** What the server takes (DataMessageSearch limits) */
export const MAX_QUERY = 64;
export const MAX_AUTHORS = 10;
export const MAX_CHANNELS = 50;

// a value: "quoted", or a quote left open (it ends before the next
// filter), or one word; @ and # may come before the quote
const TOKEN =
  /(^|\s)([A-Za-z]+):([@#]?"[^"]*"|[@#]?"(?:(?!\s+[A-Za-z]+:)[^"])*|[^\s]*)/g;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

function isKey(key: string): key is SearchKey {
  return (SEARCH_KEYS as readonly string[]).includes(key);
}

function unquote(value: string) {
  return value
    .replace(/^([@#]?)"/, "$1")
    .replace(/"$/, "")
    .trimEnd();
}

/** Split the input into words and filters */
export function parseSearch(input: string): ParsedSearch {
  const tokens: SearchToken[] = [];
  let words = "";
  let last = 0;

  for (const match of input.matchAll(TOKEN)) {
    const key = match[2].toLowerCase();
    if (!isKey(key)) continue;
    const start = match.index! + match[1].length;
    const end = match.index! + match[0].length;
    words += input.slice(last, start) + " ";
    last = end;
    tokens.push({
      key,
      value: unquote(match[3]).replace(
        key === "from" || key === "mentions"
          ? /^@/
          : key === "in"
            ? /^#/
            : /^$/,
        "",
      ),
      start,
      end,
    });
  }
  words += input.slice(last);

  return { words: words.replace(/\s+/g, " ").trim(), tokens };
}

/** ٠-٩ and ۰-۹ as 0-9 */
function asciiDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Local midnight of a YYYY-MM-DD day, or undefined */
export function parseDay(value: string): Date | undefined {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(
    asciiDigits(value.trim()),
  );
  if (!match) return;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  // 2026-13-40 rolls over: refuse it
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    return;
  return date;
}

function nextDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

const earlier = (a: string | null | undefined, b: string) =>
  a && a < b ? a : b;
const later = (a: string | null | undefined, b: string) => (a && a > b ? a : b);

/** Turn parsed input into API parameters, with what could not be read */
export function toSearchRequest(
  parsed: ParsedSearch,
  resolver: SearchResolver,
): SearchRequest {
  const params: SearchParams = {};
  const problems: SearchProblem[] = [];
  const authors: string[] = [];
  const channels: string[] = [];
  const has: HasValue[] = [];
  let serverWide = false;

  const problem = (token: SearchToken, reason: SearchProblemReason) =>
    problems.push({ key: token.key, value: token.value, reason });
  const user = (name: string) =>
    ULID.test(name) ? name.toUpperCase() : resolver.user(name);

  for (const token of parsed.tokens) {
    const value = token.value.trim();
    if (token.key === "in") {
      if (resolver.inServer === false) {
        // one plain problem, not "no channel called …" as well
        if (!problems.some((p) => p.reason === "no-server"))
          problem(token, "no-server");
        continue;
      }
      serverWide = true;
    }
    if (!value) continue;

    switch (token.key) {
      case "from": {
        const id = user(value);
        if (!id) problem(token, "unknown-user");
        else if (authors.includes(id)) break;
        else if (authors.length >= MAX_AUTHORS) problem(token, "too-many");
        else authors.push(id);
        break;
      }
      case "mentions": {
        const id = user(value);
        if (!id) problem(token, "unknown-user");
        else if (params.mentions && params.mentions !== id)
          problem(token, "one-only");
        else params.mentions = id;
        break;
      }
      case "has": {
        const kind = value.toLowerCase();
        if (!(HAS_VALUES as readonly string[]).includes(kind))
          problem(token, "bad-has");
        else if (!has.includes(kind as HasValue)) has.push(kind as HasValue);
        break;
      }
      case "in": {
        const id = ULID.test(value)
          ? value.toUpperCase()
          : resolver.channel(value);
        if (!id) problem(token, "unknown-channel");
        else if (channels.includes(id)) break;
        else if (channels.length >= MAX_CHANNELS) problem(token, "too-many");
        else channels.push(id);
        break;
      }
      case "pinned": {
        const yes = ["true", "yes", "1"].includes(value.toLowerCase());
        const no = ["false", "no", "0"].includes(value.toLowerCase());
        if (yes || no) params.pinned = yes;
        else problem(token, "bad-pinned");
        break;
      }
      case "before":
      case "after":
      case "during": {
        if (ULID.test(value) && token.key !== "during") {
          const id = value.toUpperCase();
          if (token.key === "before")
            params.before = earlier(params.before, id);
          else params.after = later(params.after, id);
          break;
        }
        const date = parseDay(value);
        if (!date) {
          problem(token, "bad-date");
          break;
        }
        const start = date.toISOString();
        const end = nextDay(date).toISOString();
        if (token.key !== "after")
          params.before_date = earlier(
            params.before_date as string | undefined,
            token.key === "before" ? start : end,
          );
        if (token.key !== "before")
          params.after_date = later(
            params.after_date as string | undefined,
            token.key === "after" ? end : start,
          );
        break;
      }
    }
  }

  // by code points, so an emoji is never cut in half
  const characters = [...parsed.words];
  if (characters.length) params.query = characters.slice(0, MAX_QUERY).join("");
  if (authors.length) params.authors = authors;
  if (has.length) params.has = has;
  if (channels.length) params.channels = channels;

  return {
    params,
    serverWide,
    problems,
    empty: Object.keys(params).length === 0,
    truncated: characters.length > MAX_QUERY,
  };
}

/** The word under the caret: a keyword and what is typed after it, or a bare word */
export function tokenAt(
  input: string,
  caret: number,
): { key: SearchKey | null; partial: string; start: number; end: number } {
  let start = caret;
  // inside quotes a space belongs to the value
  const before = input.slice(0, caret);
  const quote = before.lastIndexOf('"');
  const quoted = (before.match(/"/g)?.length ?? 0) % 2 === 1;
  if (quoted) {
    start = quote;
    while (start > 0 && !/\s/.test(input[start - 1])) start--;
  } else {
    while (start > 0 && !/\s/.test(input[start - 1])) start--;
  }
  let end = caret;
  while (end < input.length && !/\s/.test(input[end])) end++;

  const word = input.slice(start, caret);
  const colon = word.indexOf(":");
  if (colon > 0) {
    const key = word.slice(0, colon).toLowerCase();
    if (isKey(key))
      return { key, partial: unquote(word.slice(colon + 1)), start, end };
  }
  return { key: null, partial: word, start, end };
}

/** Put `text` in place of input[start, end) and a space after it */
export function replaceToken(
  input: string,
  start: number,
  end: number,
  text: string,
): { text: string; caret: number } {
  const head = input.slice(0, start) + text;
  const tail = input.slice(end).replace(/^\s*/, "");
  // a keyword waits for its value: no space after "from:"
  const spacer = text.endsWith(":") ? "" : " ";
  return { text: head + spacer + tail, caret: head.length + spacer.length };
}

/** A value as the input needs it: quoted when it has a space */
export function quoteValue(value: string) {
  return /\s/.test(value) ? `"${value.replace(/"/g, "")}"` : value;
}
