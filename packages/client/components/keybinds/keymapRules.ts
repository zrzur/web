/**
 * Rules for a new combination while the person records one (the shortcuts
 * screen only, so this stays out of the first download): what a key press
 * means, and whether the browser or the system keeps it, typing needs it,
 * or another shortcut has it.
 */
import {
  type Combo,
  type KeyLike,
  type Keymap,
  type ShortcutId,
  defaultCombo,
  eventCombo,
  keyOf,
  MODIFIER_CODE,
  normalize,
  sameCombo,
} from "./keymap";

/**
 * While recording a new combination: what this key press means
 */
export function readCombo(
  event: KeyLike,
  mac: boolean,
): Combo | "cancel" | "wait" {
  if (MODIFIER_CODE.test(event.code) || !event.code) return "wait";
  if (
    event.code === "Escape" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  )
    return "cancel";
  return eventCombo(event, mac) ?? "wait";
}

export type ComboCheck = {
  /** Can't be used: the browser or the system keeps it, or it is needed for typing */
  blocked?: "browser" | "system" | "typing";
  /** Works, but replaces what the browser does with it */
  warn?: "browser";
  /** Another shortcut has it */
  clash?: ShortcutId;
};

/** Pages never get these: tabs and windows */
const BROWSER_KEEPS = new Set([
  "M:KeyT",
  "M:KeyN",
  "M:KeyW",
  "MS:KeyT",
  "MS:KeyN",
  "MS:KeyW",
  "M:Tab",
  "MS:Tab",
]);
/** The system takes these before the browser */
const SYSTEM_KEEPS_OTHER = new Set([
  "A:F4",
  "A:Tab",
  "M:Escape",
  "MA:Delete",
  "S:F10",
]);
const SYSTEM_KEEPS_MAC = new Set([
  "M:KeyQ",
  "M:KeyH",
  "M:KeyM",
  "M:Space",
  "C:Space",
  "M:Tab",
  "MS:Digit3",
  "MS:Digit4",
  "MS:Digit5",
  "MS:Digit6",
  "MC:KeyQ",
  "MC:KeyF",
]);
/** Browser shortcuts a page can take over, for a warning */
const BROWSER_USES = new Set([
  ...[
    "A",
    "C",
    "V",
    "X",
    "Z",
    "Y",
    "F",
    "G",
    "L",
    "R",
    "P",
    "S",
    "D",
    "O",
    "K",
    "E",
    "J",
    "U",
    "B",
    "I",
    "H",
  ].map((l) => `M:Key${l}`),
  ...[
    "I",
    "J",
    "C",
    "R",
    "K",
    "E",
    "O",
    "A",
    "D",
    "S",
    "Y",
    "H",
    "P",
    "B",
    "Q",
    "Z",
    "V",
    "U",
    "M",
    "G",
    "X",
    "Delete",
  ].map((l) => (l === "Delete" ? "MS:Delete" : `MS:Key${l}`)),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `M:Digit${d}`),
  "M:Equal",
  "M:Minus",
  ":F1",
  ":F3",
  ":F5",
  ":F6",
  ":F7",
  ":F12",
  "M:F5",
  "A:ArrowLeft",
  "A:ArrowRight",
  "A:Home",
]);

const PRINTABLE =
  /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash|IntlRo|IntlYen|Space)$/;
const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;

/**
 * Whether this combination can be used for a shortcut, and what it clashes
 * with. A shortcut's own default is always fine.
 */
export function checkCombo(
  id: ShortcutId,
  combo: Combo,
  map: Keymap,
  mac: boolean,
): ComboCheck {
  const key = keyOf(combo, mac);
  const c = normalize(combo, mac);
  const result: ComboCheck = {};
  const isDefault = sameCombo(c, defaultCombo(id, mac));

  if (!isDefault) {
    if (BROWSER_KEEPS.has(key) || key === ":F11") result.blocked = "browser";
    else if ((mac ? SYSTEM_KEEPS_MAC : SYSTEM_KEEPS_OTHER).has(key))
      result.blocked = "system";
    else if (!c.mod && !c.ctrl && !c.alt && !FUNCTION_KEY.test(c.code))
      // plain keys and Shift+key type text or move around
      result.blocked = "typing";
    else if (
      PRINTABLE.test(c.code) &&
      ((!mac && c.mod && c.alt) || (mac && c.alt && !c.mod && !c.ctrl))
    )
      // AltGr (Ctrl+Alt on Windows) and Option on a Mac type characters
      result.blocked = "typing";
    else if (BROWSER_USES.has(key)) result.warn = "browser";
  }

  const other = map.byCombo.get(key);
  if (other && other !== id) result.clash = other;
  return result;
}
