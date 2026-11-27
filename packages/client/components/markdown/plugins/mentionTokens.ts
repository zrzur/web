/**
 * Mentions in message text: a person, a role, `@everyone`, and `@here` for
 * the members who are online (`@online` is the older way to write it)
 */
export const RE_MENTION =
  /(<@[ABCDEFGHJKMNPQRSTVWXYZ\d]{26}>|@everyone|@online|@here|<%[ABCDEFGHJKMNPQRSTVWXYZ\d]{26}>)/;

/** What a matched mention points at, as the `mentions` of its node */
export function mentionTarget(value: string): string {
  if (value.startsWith("<@")) return "user:" + value.slice(2, -1);
  if (value === "@everyone") return "everyone";
  if (value === "@online" || value === "@here") return "online";
  return "role:" + value.slice(2, -1);
}
