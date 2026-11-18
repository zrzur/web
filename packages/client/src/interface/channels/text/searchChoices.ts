import { createSignal } from "solid-js";

import type { API } from "@zrzur/sdk/solid";

import { type SearchKey, parseSearch } from "./searchSyntax";

/**
 * Where a search looks and how its results are ordered. Chosen in two
 * places that are far apart on a phone (the filter sheet opened from the
 * search field's row, and the page of results), so they live here.
 */
export type SearchScope = "channel" | "server";
export type SearchSort = NonNullable<API.DataMessageSearch["sort"]>;

export const [searchScope, setSearchScope] =
  createSignal<SearchScope>("channel");
export const [searchSort, setSearchSort] = createSignal<SearchSort>("Latest");

/** A filter as it is written in the search field */
export function writeFilter(key: SearchKey, value: string) {
  return /\s/.test(value) ? `${key}:"${value}"` : `${key}:${value}`;
}

/** The query with one more filter at its end (once only) */
export function addFilter(query: string, key: SearchKey, value: string) {
  const has = parseSearch(query).tokens.some(
    (token) =>
      token.key === key && token.value.toLowerCase() === value.toLowerCase(),
  );
  if (has) return query;
  return `${query.trim()} ${writeFilter(key, value)}`.trim();
}

/** The query without the filter `key:value` */
export function removeFilter(query: string, key: SearchKey, value: string) {
  let out = query;
  // from the end, so the positions of the ones before stay right
  for (const token of [...parseSearch(query).tokens].reverse()) {
    if (token.key === key && token.value.toLowerCase() === value.toLowerCase())
      out = out.slice(0, token.start) + out.slice(token.end);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** The query without any filter of this kind (a day replaces a day) */
export function removeKey(query: string, key: SearchKey) {
  let out = query;
  for (const token of [...parseSearch(query).tokens].reverse()) {
    if (token.key === key)
      out = out.slice(0, token.start) + out.slice(token.end);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Today (or days ago) as the search writes a day: 2026-11-09, local time */
export function dayValue(daysAgo = 0, now = new Date()) {
  const day = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
  );
  const two = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`;
}
