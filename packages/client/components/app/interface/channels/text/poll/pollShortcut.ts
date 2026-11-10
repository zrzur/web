/**
 * "Create poll" opens with Alt+Shift+P. The key is matched by its place on
 * the keyboard (`event.code`), so it is the same on Arabic and German
 * layouts, and it stays clear of the browser's own Ctrl shortcuts.
 */
type KeyLike = Pick<
  KeyboardEvent,
  "code" | "altKey" | "shiftKey" | "ctrlKey" | "metaKey"
>;

/** Whether this key press is the "Create poll" shortcut */
export function isCreatePollShortcut(event: KeyLike): boolean {
  return (
    event.code === "KeyP" &&
    event.altKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

let claimedAt = 0;

/**
 * Two message boxes can be on screen (a channel and a thread beside it);
 * only the first to hear the key press opens the window
 * @param now Time of the key press (for tests)
 */
export function claimCreatePollShortcut(now = Date.now()): boolean {
  if (now - claimedAt < 300) return false;
  claimedAt = now;
  return true;
}
