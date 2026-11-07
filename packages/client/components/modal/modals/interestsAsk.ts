/** A role question as far as deciding whether to ask goes */
type Question = { options: { role: string }[] };

/**
 * Whether to open the interests window for a member: the server asks role
 * questions, the member holds none of the roles they give, and they have not
 * skipped or finished the window on this device yet.
 */
export function shouldAskInterests(
  questions: Question[] | undefined,
  memberRoles: string[],
  dismissed: boolean,
): boolean {
  if (dismissed) return false;
  const roles = (questions ?? []).flatMap((q) => q.options.map((o) => o.role));
  if (!roles.length) return false;
  return !roles.some((role) => memberRoles.includes(role));
}

/** Device storage key: the window was skipped or finished for this server */
export function interestsKey(serverId: string, userId: string) {
  return `zrzur:interests:${serverId}:${userId}`;
}
