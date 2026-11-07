/**
 * Server privacy, built on what the backend already enforces:
 * - visibility: `discoverable` lists the server on Discover; otherwise it is
 *   private (not listed, non-members get 404, joining needs an invite)
 * - who can invite: the default permission "Invite Others"; when it is off,
 *   only roles that grant it can create invites
 */

/** Invite Others (stoat.js `Permission.InviteOthers`) */
export const INVITE_OTHERS = 2n ** 25n;

/** Whether every member may create invites */
export function membersCanInvite(defaultPermissions: bigint): boolean {
  return (defaultPermissions & INVITE_OTHERS) === INVITE_OTHERS;
}

/** How open each access mode is: higher lets more people in */
const OPENNESS = { Locked: 0, Approval: 1, Open: 2 } as const;

/** Whether moving from one access mode to another lets more people in */
export function opensAccess(
  from: keyof typeof OPENNESS,
  to: keyof typeof OPENNESS,
): boolean {
  return OPENNESS[to] > OPENNESS[from];
}

/** The default permissions with only the invite bit changed */
export function withMemberInvites(
  defaultPermissions: bigint,
  allowed: boolean,
): bigint {
  return allowed
    ? defaultPermissions | INVITE_OTHERS
    : defaultPermissions & ~INVITE_OTHERS;
}
