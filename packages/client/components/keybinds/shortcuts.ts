/**
 * App-wide shortcuts that work on every screen (voice and help), plus the
 * key names shown in the shortcuts list. Keys are matched by their physical
 * position (`event.code`), so they stay the same on Arabic, German or any
 * other keyboard layout.
 *
 * The combos are also in the plugin SDK's RESERVED_KEYS, so a plugin can
 * never take them over.
 */

export type GlobalShortcut = "toggle_mute" | "toggle_deafen" | "open_shortcuts";

type Combo = { code: string; mod: boolean; shift: boolean; alt: boolean };

const GLOBAL_SHORTCUTS: Record<GlobalShortcut, Combo> = {
  toggle_mute: { code: "KeyM", mod: true, shift: true, alt: false },
  toggle_deafen: { code: "KeyD", mod: true, shift: true, alt: false },
  open_shortcuts: { code: "Slash", mod: true, shift: false, alt: false },
};

type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
>;

/**
 * Which app-wide shortcut this key press is, if any
 * @param event Key press
 * @param mac Whether Command takes the place of Ctrl
 */
export function matchGlobalShortcut(
  event: KeyLike,
  mac: boolean,
): GlobalShortcut | undefined {
  const mod = mac ? event.metaKey : event.ctrlKey;
  const other = mac ? event.ctrlKey : event.metaKey;
  if (other) return;
  return (Object.keys(GLOBAL_SHORTCUTS) as GlobalShortcut[]).find((id) => {
    const combo = GLOBAL_SHORTCUTS[id];
    return (
      combo.code === event.code &&
      combo.mod === mod &&
      combo.shift === event.shiftKey &&
      combo.alt === event.altKey
    );
  });
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

/**
 * While choosing a push-to-talk key: what this key press means
 */
export function readPttKey(
  event: Pick<KeyboardEvent, "code">,
): { code: string } | "cancel" | "blocked" | "wait" {
  if (event.code === "Escape") return "cancel";
  if (/^(Control|Meta|Shift|Alt|OS)(Left|Right)?$/.test(event.code))
    return "wait";
  return pttKeyAllowed(event.code) ? { code: event.code } : "blocked";
}

const NAMED: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  IntlBackslash: "\\",
  CapsLock: "Caps Lock",
  ScrollLock: "Scroll Lock",
  NumLock: "Num Lock",
  PageUp: "Page Up",
  PageDown: "Page Down",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ContextMenu: "Menu",
};

/**
 * The name printed on a key, from its physical code
 */
export function keyLabel(code: string) {
  const match = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code);
  if (match) return match[1] ?? match[2];
  const numpad = /^Numpad(.+)$/.exec(code);
  if (numpad) return `Num ${NAMED[numpad[1]] ?? numpad[1]}`;
  return NAMED[code] ?? code;
}

/**
 * Key caps for a combo; "Mod" is Ctrl, or Command on a Mac
 */
export function comboLabel(keys: string[], mac: boolean) {
  const macNames: Record<string, string> = {
    Mod: "⌘",
    Shift: "⇧",
    Alt: "⌥",
    Ctrl: "⌃",
  };
  return keys.map((key) =>
    mac ? (macNames[key] ?? key) : key === "Mod" ? "Ctrl" : key,
  );
}

/** Whether this device uses Command for shortcuts */
export const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
