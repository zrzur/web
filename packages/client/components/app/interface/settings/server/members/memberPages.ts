/**
 * The Members page loads members a page at a time. Search covers what is
 * loaded; while pages are still missing, the server is asked too.
 */

type Keyed = { id: { user: string } };

/** Loaded pages, then search results, each member once */
export function mergeMembers<T extends Keyed>(pages: T[][], found: T[] = []): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const member of [...pages.flat(), ...found]) {
    if (seen.has(member.id.user)) continue;
    seen.add(member.id.user);
    out.push(member);
  }
  return out;
}

/** Search on the server: at least two characters, and pages still missing */
export function needsServerSearch(query: string, hasMorePages: boolean) {
  return hasMorePages && query.trim().length >= 2;
}

/**
 * Query string for one page of members. The generated API client only
 * passes `exclude_offline` on this route and drops `limit` and `after`, so
 * the page request is made here and the server really pages.
 */
export function memberPageQuery(options: { limit?: number; after?: string }) {
  const query = new URLSearchParams();
  if (options.limit) query.set("limit", String(options.limit));
  if (options.after) query.set("after", options.after);
  return query.toString();
}
