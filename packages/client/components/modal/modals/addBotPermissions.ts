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

/** Permission groups in the add dialog, every permission the server has */
export const PERMISSION_GROUPS: {
  id: "server" | "members" | "messages" | "voice";
  bits: number[];
}[] = [
  // manage channel, server, permissions, roles, customisation, webhooks,
  // join requests, audit log
  {
    id: "server",
    bits: [0, 1, 2, 3, 4, 24, 42, 40].map((bit) => 2 ** bit),
  },
  // kick, ban, timeout, assign roles, nicknames, avatars
  { id: "members", bits: [6, 7, 8, 9, 10, 11, 12, 13].map((bit) => 2 ** bit) },
  // view, history, send, manage messages, invite, embeds, files, masquerade,
  // react, mentions, slowmode, other emoji, threads and forum posts
  {
    id: "messages",
    bits: [20, 21, 22, 23, 25, 26, 27, 28, 29, 37, 38, 39, 41, 43, 44, 45].map(
      (bit) => 2 ** bit,
    ),
  },
  // connect, speak, video, mute, deafen, move, listen
  { id: "voice", bits: [30, 31, 32, 33, 34, 35, 36].map((bit) => 2 ** bit) },
];

/**
 * Every permission a bot asks for, by group. Bits this app has no name for
 * are listed under "other" with their number, so nothing asked is hidden.
 */
export function askedGroups(asked: number) {
  const known = new Set(PERMISSION_GROUPS.flatMap((group) => group.bits));
  const groups: { id: string; bits: number[] }[] = PERMISSION_GROUPS.map(
    (group) => ({
      id: group.id,
      bits: group.bits.filter((bit) => hasBit(asked, bit)),
    }),
  );
  const other: number[] = [];
  for (let bit = 1, n = 0; n < 53; bit *= 2, n++) {
    if (hasBit(asked, bit) && !known.has(bit)) other.push(bit);
  }
  groups.push({ id: "other", bits: other });
  return groups.filter((group) => group.bits.length);
}
