/**
 * "Create poll" opens with Ctrl+Shift+7 (Command+Shift+7 on a Mac). The key
 * is matched by its place on the keyboard (`event.code`), so it is the same
 * on Arabic, German and French layouts. Never Alt+Shift (Windows switches
 * the keyboard layout with it) and never Ctrl+Alt (AltGr on Windows); no
 * browser uses Ctrl+Shift+7, and plugins can't take it (RESERVED_KEYS).
 */
type KeyLike = Pick<
  KeyboardEvent,
  "code" | "altKey" | "shiftKey" | "ctrlKey" | "metaKey"
>;

/** The same key as plugin manifests write it (kept in RESERVED_KEYS) */
export const CREATE_POLL_PLUGIN_KEYS = ["Ctrl+Shift+7"];

/**
 * Whether this key press is the "Create poll" shortcut
 * @param mac Whether Command takes the place of Ctrl
 */
export function isCreatePollShortcut(event: KeyLike, mac: boolean): boolean {
  const mod = mac ? event.metaKey : event.ctrlKey;
  const other = mac ? event.ctrlKey : event.metaKey;
  return (
    event.code === "Digit7" && mod && !other && event.shiftKey && !event.altKey
  );
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
