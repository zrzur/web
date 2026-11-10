/**
 * Pure notification rules shared by the store, the menus and their tests.
 */

/** What a member is notified about in a server or channel */
export type NotificationState = "all" | "mention" | "none";

/** A server's default level, as the API sends it */
export type ServerNotificationLevel = "All" | "Mentions";

/** Message flag bits as the server sends them (bit positions 2 and 3) */
export const MENTIONS_EVERYONE = 1 << 2;
export const MENTIONS_ONLINE = 1 << 3;

/**
 * The level for a server: the member's own choice, else the server's
 * default, else mentions only
 */
export function effectiveServerState(
  own: NotificationState | undefined,
  serverDefault: ServerNotificationLevel | undefined,
): NotificationState {
  if (own) return own;
  return serverDefault === "All" ? "all" : "mention";
}

/**
 * Whether a suppress option is on for a channel: its own choice, else the
 * server's, else off
 */
export function effectiveSuppress(
  channel: boolean | undefined,
  server: boolean | undefined,
): boolean {
  return channel ?? server ?? false;
}

/**
 * Whether a message mentions the reader for notifications, after the
 * reader's suppress options. A mention by name always counts.
 */
export function mentionsForNotification(input: {
  /** This account's user id */
  selfId: string | undefined;
  /** Users the message mentions by name */
  mentionIds: string[] | undefined;
  /** Message flags field */
  flags: number;
  /** Whether it mentions a role the reader has */
  mentionsMyRole: boolean;
  /** @everyone and @here are suppressed here */
  suppressEveryone: boolean;
  /** Role mentions are suppressed here */
  suppressRoles: boolean;
}): boolean {
  if (input.selfId && input.mentionIds?.includes(input.selfId)) return true;
  if (
    !input.suppressEveryone &&
    (input.flags & (MENTIONS_EVERYONE | MENTIONS_ONLINE)) !== 0
  )
    return true;
  return !input.suppressRoles && input.mentionsMyRole;
}
