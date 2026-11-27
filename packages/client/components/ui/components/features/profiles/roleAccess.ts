/**
 * Who may give and take which roles, as the API decides it. One place for
 * the role picker and the role chips on a profile.
 */

/** The parts of a member these rules read */
export type RoleMember = {
  roles: string[];
  ranking: number;
  user?: { self?: boolean };
  inferiorTo(other: RoleMember): boolean;
  server?: {
    owner?: { self?: boolean };
    member?: RoleMember;
    havePermission(permission: "AssignRoles"): boolean;
  };
};

/** A role as these rules read it */
export type RoleLike = { rank?: number; isManaged?: boolean };

/**
 * Whether you may change this member's roles at all: the owner always; with
 * Assign Roles, your own and those of members below you
 */
export function canEditRoles(member: RoleMember | undefined): boolean {
  const server = member?.server;
  if (!member || !server) return false;
  if (server.owner?.self) return true;
  if (!server.havePermission("AssignRoles")) return false;
  return (
    !!member.user?.self || (!!server.member && member.inferiorTo(server.member))
  );
}

/**
 * Whether you may give or take this role: never a bot's own role, and only
 * roles strictly below your own highest one (the owner may give any)
 */
export function canGiveRole(
  member: RoleMember | undefined,
  role: RoleLike,
): boolean {
  if (!member?.server || role.isManaged) return false;
  if (member.server.owner?.self) return true;
  return (role.rank ?? 0) > (member.server.member?.ranking ?? Infinity);
}

/** The member's roles with one given or taken, unknown ids left out */
export function rolesWith(
  current: string[],
  roleId: string,
  on: boolean,
  known: (id: string) => boolean,
): string[] {
  const rest = current.filter((id) => id !== roleId && known(id));
  return on ? [...rest, roleId] : rest;
}
