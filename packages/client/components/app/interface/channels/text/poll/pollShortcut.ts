/**
 * "Create poll" opens with Ctrl+Shift+8 (Command+Shift+8 on a Mac). The key
 * is matched by its place on the keyboard (`event.code`), so it is the same
 * on Arabic, German and French layouts. Not Shift+7: on German, Spanish,
 * Italian and Nordic layouts that types "/", so Ctrl+Shift+7 is their Ctrl+/
 * (the shortcuts screen); a press that types "/" is never taken. Never
 * Alt+Shift (Windows switches the keyboard layout with it) and never Ctrl+Alt
 * (AltGr on Windows); no browser uses Ctrl+Shift+8, and plugins can't take
 * it (RESERVED_KEYS).
 */
import { shortcutFor } from "../../../../../keybinds/active";

type KeyLike = Pick<
  KeyboardEvent,
  "code" | "key" | "altKey" | "shiftKey" | "ctrlKey" | "metaKey"
>;

/** The same key as plugin manifests write it (kept in RESERVED_KEYS) */
export const CREATE_POLL_PLUGIN_KEYS = ["Ctrl+Shift+8"];

/**
 * Whether this key press is the "Create poll" shortcut (the person's own
 * keys if they changed it in Ctrl+/)
 * @param mac Whether Command takes the place of Ctrl
 */
export function isCreatePollShortcut(event: KeyLike, mac: boolean): boolean {
  return shortcutFor(event, mac) === "create_poll";
}

/** Message boxes on screen, in the order they appeared */
const shown: string[] = [];
let focused: string | undefined;

/** A message box appeared (its channel id) */
export function noteComposer(id: string) {
  if (!shown.includes(id)) shown.push(id);
}

/** A message box went away */
export function forgetComposer(id: string) {
  const index = shown.indexOf(id);
  if (index !== -1) shown.splice(index, 1);
  if (focused === id) focused = undefined;
}

/** Someone typed or clicked into a message box */
export function noteComposerFocus(id: string) {
  focused = id;
}

/**
 * The message box the shortcut is for: the one focused last, or the first
 * one shown (a channel with a thread beside it has two)
 */
export function composerForShortcut(): string | undefined {
  return focused && shown.includes(focused) ? focused : shown[0];
}
