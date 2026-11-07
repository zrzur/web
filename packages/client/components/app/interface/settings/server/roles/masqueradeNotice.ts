import { Permission } from "@zrzur/sdk/solid";

/**
 * Servers made before Zrzur may let everyone post under another name
 * (Masquerade in @everyone). New servers don't; Roles suggests turning it
 * off once.
 */
export function everyoneCanMasquerade(defaultPermissions: bigint) {
  return (defaultPermissions & Permission.Masquerade) !== 0n;
}

/** @everyone's permissions without Masquerade, as the API takes them */
export function withoutMasquerade(defaultPermissions: bigint) {
  return Number(defaultPermissions & ~Permission.Masquerade);
}

const key = (serverId: string) => `zrzur:masquerade-notice:${serverId}`;

/** Whether this viewer already closed the notice for this server */
export function noticeDismissed(serverId: string) {
  try {
    return localStorage.getItem(key(serverId)) === "1";
  } catch {
    return false;
  }
}

export function dismissNotice(serverId: string) {
  try {
    localStorage.setItem(key(serverId), "1");
  } catch {
    /* private mode: the notice comes back next time */
  }
}
