/**
 * Rules for a new combination while the person records one, and the edits
 * of the keybinds store (the shortcuts screen only, so this stays out of
 * the first download): what a key press means, whether the browser or the
 * system keeps it, typing needs it, or another shortcut has it.
 */
import type { Keybinds } from "../state/stores/Keybinds";

import { activeKeymap, deviceMac } from "./active";
import { keyLabel } from "./keyLabels";
import {
  type Combo,
  type CustomCombos,
  type KeyLike,
  type Keymap,
  type ShortcutId,
  defaultCombo,
  eventCombo,
  keyOf,
  matchShortcut,
  MODIFIER_CODE,
  normalize,
} from "./keymap";
import { cleanCustom, unusable } from "./keymapCompile";
import { pttKeyAllowed } from "./shortcuts";

/** Whether two combinations are the same keys */
export function sameCombo(a: Combo | undefined, b: Combo | undefined) {
  if (!a || !b) return false;
  // compared as written for both systems: a Mac's Control equals Ctrl only off a Mac
  return (
    keyOf(a, false) === keyOf(b, false) && keyOf(a, true) === keyOf(b, true)
  );
}

/**
 * Give `id` the combination `combo`, and the shortcut that had it this
 * one's old combination (nothing is left without a shortcut)
 */
export function swapCombos(
  custom: CustomCombos,
  id: ShortcutId,
  other: ShortcutId,
  combo: Combo,
  map: Keymap,
): CustomCombos {
  return {
    ...cleanCustom(custom, deviceMac()),
    [id]: combo,
    [other]: map.byId[id],
  };
}

/** Key caps for a combination, as `comboLabel` writes them */
export function comboKeys(combo: Combo): string[] {
  const keys: string[] = [];
  if (combo.ctrl) keys.push("Ctrl");
  if (combo.mod) keys.push("Mod");
  if (combo.alt) keys.push("Alt");
  if (combo.shift) keys.push("Shift");
  keys.push(keyLabel(combo.code));
  return keys;
}

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
  blocked?: "browser" | "system" | "typing" | "ptt";
  /** Works, but replaces what the browser does with it */
  warn?: "browser";
  /** Another shortcut has it */
  clash?: ShortcutId;
};

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
/** Alt+letter opens the browser's menus on Windows and Linux */
const ALT_LETTER = /^AS?:Key[A-Z]$/;

/**
 * Whether this combination can be used for a shortcut, and what it clashes
 * with. A shortcut's own default is always fine.
 */
export function checkCombo(
  id: ShortcutId,
  combo: Combo,
  map: Keymap,
  mac: boolean,
  options: { pttKey?: string; typesSlash?: boolean } = {},
): ComboCheck {
  const key = keyOf(combo, mac);
  const c = normalize(combo, mac);
  const result: ComboCheck = {};
  const isDefault = sameCombo(c, defaultCombo(id, mac));

  if (!isDefault) {
    const no = unusable(c, mac);
    if (no) result.blocked = no;
    else if ((mac ? SYSTEM_KEEPS_MAC : SYSTEM_KEEPS_OTHER).has(key))
      result.blocked = "system";
    else if (!c.mod && !c.ctrl && !c.alt && c.code === options.pttKey)
      // held to talk: the same key alone can't also be a shortcut
      result.blocked = "ptt";
    else if (BROWSER_USES.has(key) || (!mac && ALT_LETTER.test(key)))
      result.warn = "browser";
  }

  const other = map.byCombo.get(key);
  if (other && other !== id) result.clash = other;
  // a press that types "/" with Ctrl is Ctrl+/ on this keyboard
  else if (
    options.typesSlash &&
    c.mod &&
    !c.alt &&
    map.slashDefault &&
    id !== "open_shortcuts"
  )
    result.clash = "open_shortcuts";
  return result;
}

// ---------------------------------------------------------------- store edits

/** The person's changes, without the ones equal to the default again */
function withoutDefaults(custom: CustomCombos): CustomCombos {
  const mac = deviceMac();
  const out: CustomCombos = {};
  for (const [id, combo] of Object.entries(cleanCustom(custom, mac)) as [
    ShortcutId,
    Combo,
  ][])
    if (!sameCombo(combo, defaultCombo(id, mac))) out[id] = combo;
  return out;
}

/** Give a shortcut a new combination */
export function setCombo(store: Keybinds, id: ShortcutId, combo: Combo) {
  store.replaceCustom(
    withoutDefaults({ ...cleanCustom(store.custom, deviceMac()), [id]: combo }),
  );
}

/**
 * Give a shortcut the combination another one has; that one gets this
 * shortcut's old combination
 */
export function swapShortcuts(
  store: Keybinds,
  id: ShortcutId,
  other: ShortcutId,
  combo: Combo,
) {
  store.replaceCustom(
    withoutDefaults(
      swapCombos(
        cleanCustom(store.custom, deviceMac()),
        id,
        other,
        combo,
        store.table(),
      ),
    ),
  );
}

/** One shortcut back to its default */
export function resetShortcut(store: Keybinds, id: ShortcutId) {
  const next = { ...cleanCustom(store.custom, deviceMac()) };
  delete next[id];
  store.replaceCustom(next);
}

/** Every shortcut, and the push-to-talk key, back to the defaults */
export function resetAllShortcuts(store: Keybinds) {
  store.replaceCustom({});
  store.pttKey = "Backquote";
}

/** Whether anything differs from the defaults */
export function shortcutsChanged(store: Keybinds, pttKey: string): boolean {
  return (
    Object.keys(cleanCustom(store.custom, deviceMac())).length > 0 ||
    pttKey !== "Backquote"
  );
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
  if (!pttKeyAllowed(event.code)) return "blocked";
  // a key that is a shortcut on its own (an F key) can't also be held to talk
  const mac = deviceMac();
  if (
    matchShortcut(
      activeKeymap(mac),
      {
        code: event.code,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      },
      mac,
    )
  )
    return "blocked";
  return { code: event.code };
}
