import { Permission, serverChannelPermission } from "@zrzur/sdk";

/** An allow / deny pair, as bigints */
export type Pair = { a: bigint; d: bigint };

const VIEW = Permission.ViewChannel;

export function pair(value?: { a: number | bigint; d: number | bigint }): Pair {
  return { a: BigInt(value?.a ?? 0), d: BigInt(value?.d ?? 0) };
}

/**
 * Whether a member holding only this role (or no role) sees the channel,
 * worked out in the API's order
 */
export function sees(
  serverDefault: bigint,
  everyone: Pair,
  role?: { permissions: Pair; override?: Pair },
): boolean {
  const perm = serverChannelPermission({
    serverDefault,
    channelDefault: everyone,
    serverRoles: role ? [role.permissions] : [],
    channelRoles: role?.override ? [role.override] : [],
    timedOut: false,
  });
  return (perm & VIEW) === VIEW;
}

/** The channel's @everyone override with View denied or no longer denied */
export function everyoneOverride(everyone: Pair, makePrivate: boolean): Pair {
  return makePrivate
    ? { a: everyone.a & ~VIEW, d: everyone.d | VIEW }
    : { a: everyone.a, d: everyone.d & ~VIEW };
}

/**
 * The role's channel override that lets it in, or keeps it out: without its
 * own allow the role may still see the channel (it is open to everyone, or
 * the role has View server-wide), so then it is denied here
 */
export function roleOverride(
  serverDefault: bigint,
  everyone: Pair,
  role: { permissions: Pair; override?: Pair },
  see: boolean,
): Pair {
  const current = role.override ?? { a: 0n, d: 0n };
  const next = { a: current.a & ~VIEW, d: current.d & ~VIEW };
  if (see) return { a: next.a | VIEW, d: next.d };
  if (
    sees(serverDefault, everyone, {
      permissions: role.permissions,
      override: next,
    })
  )
    return { a: next.a, d: next.d | VIEW };
  return next;
}
