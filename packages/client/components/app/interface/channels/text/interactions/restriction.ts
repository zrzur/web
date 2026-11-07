/** Who may use a component (as the bot set it) */
export type Restriction = { users?: string[]; roles?: string[] };

/**
 * Whether this person may use a component. The server decides for real;
 * this only lets the app show a component as not for them before a click.
 * Empty lists mean anyone who can see the message.
 */
export function restrictionAllows(
  restrict: Restriction | undefined,
  userId: string | undefined,
  roleIds: string[],
) {
  const users = restrict?.users ?? [];
  const roles = restrict?.roles ?? [];
  if (!users.length && !roles.length) return true;
  if (userId && users.includes(userId)) return true;
  return roleIds.some((role) => roles.includes(role));
}
