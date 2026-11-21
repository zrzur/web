/**
 * The link a friend-request notification opens: `/friends?profile=<userId>`.
 * The Friends page reads it, opens that person's profile and takes the
 * parameter off the address again.
 */

/** the search parameter that names the profile to open */
export const PROFILE_PARAM = "profile";

/** a user id: 26 characters of the ULID alphabet (no I, L, O or U) */
const RE_USER_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * The value of `?profile=` in a location search, trimmed; undefined when
 * the parameter is missing or empty. It is not checked here: a value that
 * is not an id still deserves a notice.
 */
export function profileLinkId(search: string): string | undefined {
  const value = new URLSearchParams(search).get(PROFILE_PARAM)?.trim();
  return value ? value : undefined;
}

/** whether a value has the shape of a user id */
export function isUserId(value: string): boolean {
  return RE_USER_ID.test(value);
}

/**
 * The search without `profile`, with its "?" when anything is left, or ""
 */
export function withoutProfileParam(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.has(PROFILE_PARAM)) return search;
  params.delete(PROFILE_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/** the relative link that opens a person's profile on the Friends page */
export function friendProfilePath(userId: string): string {
  return `/friends?${PROFILE_PARAM}=${encodeURIComponent(userId)}`;
}
