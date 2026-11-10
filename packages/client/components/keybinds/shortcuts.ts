/**
 * App-wide shortcuts that work on every screen (voice and help), plus the
 * key names shown in the shortcuts list. Keys are matched by their physical
 * position (`event.code`), so they stay the same on Arabic, German or any
 * other keyboard layout.
 *
 * The default combos are also in the plugin SDK's RESERVED_KEYS, so a
 * plugin can never take them over.
 */
import { shortcutFor } from "./active";

export type GlobalShortcut =
  | "toggle_mute"
  | "toggle_deafen"
  | "open_shortcuts"
  | "toggle_streamer";

type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
> & { key?: string };

/**
 * Which app-wide shortcut this key press is, if any (with the person's own
 * keys, see keymap.ts)
 * @param event Key press
 * @param mac Whether Command takes the place of Ctrl
 */
export function matchGlobalShortcut(
  event: KeyLike,
  mac: boolean,
): GlobalShortcut | undefined {
  const id = shortcutFor(event, mac);
  // the app-wide ones: toggle_mute, toggle_deafen, toggle_streamer, open_shortcuts
  return id && /^(toggle_|open_s)/.test(id)
    ? (id as GlobalShortcut)
    : undefined;
}

const NOT_TYPING_INPUTS = new Set([
  "button",
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "submit",
  "reset",
  "image",
]);

/**
 * Whether a key press goes into a text field (then push to talk and single
 * key shortcuts must leave it alone)
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement)
    return !NOT_TYPING_INPUTS.has(target.type);
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.nodeName === "MDUI-TEXT-FIELD"
  )
    return true;
  return (
    target.isContentEditable ||
    !!target.closest("[contenteditable]:not([contenteditable='false'])")
  );
}

export type VoiceInputMode = "voice" | "ptt";

/**
 * Whether the microphone may send sound right now
 * @param mode Voice activity (always) or push to talk (while held)
 * @param held Whether the push-to-talk key is down
 */
export function transmitting(mode: VoiceInputMode, held: boolean) {
  return mode === "voice" || held;
}

/** Keys that must keep their own job: leaving, moving focus, sending, modifiers */
const BLOCKED_PTT =
  /^(Escape|Tab|Enter|NumpadEnter|Backspace|(Control|Meta|Shift|Alt|OS)(Left|Right)?)$/;

/**
 * Whether a key can be used for push to talk
 */
export function pttKeyAllowed(code: string) {
  return !!code && !BLOCKED_PTT.test(code);
}

/** Whether this device uses Command for shortcuts */
export const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
