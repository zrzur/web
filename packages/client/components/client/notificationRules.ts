/**
 * When a message must not raise a desktop notification or sound. Pure, so
 * the page and its tests share one rule.
 */
export function skipDesktopNotification(input: {
  /** This account's user id */
  selfId: string | undefined;
  /** Author of the message */
  authorId: string | undefined;
  /** Channel of the message */
  channelId: string;
  /** Channel open on screen, if any */
  viewingChannelId: string | undefined;
  /** Whether the window has focus */
  focused: boolean;
  /** Whether the page is visible */
  visible: boolean;
}): boolean {
  // your own messages, sent here or from another device, never notify you
  if (input.selfId && input.authorId === input.selfId) return true;
  // you are reading this channel right now
  return (
    input.viewingChannelId === input.channelId && input.focused && input.visible
  );
}

/**
 * Service worker: whether an open page shows notifications itself, so a
 * web push must not show a second one. A visible or focused page is
 * connected and decides on its own (and knows which channel is open).
 */
export function pageHandlesPush(
  clients: ReadonlyArray<{ visibilityState: string; focused: boolean }>,
): boolean {
  return clients.some(
    (client) => client.visibilityState === "visible" || client.focused,
  );
}

/** Message the service worker sends an open page after a notification tap */
export const NOTIFICATION_OPEN = "NOTIFICATION_OPEN";

/**
 * The page a tapped notification asks an open page to show, if the message
 * is one: only a path inside this app, never another site.
 */
export function openFromNotification(data: unknown): string | undefined {
  if (
    typeof data !== "object" ||
    data === null ||
    (data as { type?: unknown }).type !== NOTIFICATION_OPEN
  )
    return undefined;
  const path = (data as { path?: unknown }).path;
  return typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//")
    ? path
    : undefined;
}

/**
 * Service worker: which open page a tapped notification goes to. The one
 * in front first, else any; none means a new window.
 */
export function pageForNotification<
  T extends { focused: boolean; visibilityState: string },
>(clients: ReadonlyArray<T>): T | undefined {
  return (
    clients.find((client) => client.focused) ??
    clients.find((client) => client.visibilityState === "visible") ??
    clients[0]
  );
}
