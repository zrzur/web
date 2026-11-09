/**
 * Permissions when adding a bot to a server.
 *
 * The dialog asks for what the invite link names (Developer Portal links
 * carry `?permissions=`), else for the bot's own default permissions, so
 * adding from Discover or a profile gives the bot its role too.
 */
export function askedPermissions(
  invite: { defaultPermissions?: number },
  link?: number,
): number | undefined {
  for (const value of [link, invite.defaultPermissions]) {
    if (value !== undefined && Number.isSafeInteger(value) && value > 0)
      return value;
  }
  return undefined;
}

/** Whether a permission bit is set; works past 2^31 (no bit operators) */
export const hasBit = (permissions: number, bit: number) =>
  Math.floor(permissions / bit) % 2 === 1;

/** Tick or untick one permission bit */
export const toggleBit = (permissions: number, bit: number) =>
  hasBit(permissions, bit) ? permissions - bit : permissions + bit;

/** Query of `POST /bots/{id}/invite`: permissions only for a server */
export const inviteQuery = (isServer: boolean, permissions?: number) =>
  isServer && permissions ? `?permissions=${permissions}` : "";
