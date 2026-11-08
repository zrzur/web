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
