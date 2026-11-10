/**
 * A person's own shortcuts, compiled into the lookup table. Loaded only
 * when there are some (the keybinds store asks for it) or with the
 * shortcuts screen, so people who never change a shortcut never download it.
 */
import { setCompiler } from "./active";
import {
  type Combo,
  type CustomCombos,
  type Keymap,
  type ShortcutId,
  MODIFIER_CODE,
  REMAPPABLE,
  defaultCombo,
  isShortcutId,
  keyOf,
  normalize,
} from "./keymap";

/** Whether data from storage or sync is a usable combination */
export function validCombo(value: unknown): value is Combo {
  if (!value || typeof value !== "object") return false;
  const combo = value as Record<string, unknown>;
  if (typeof combo.code !== "string" || !/^[A-Za-z0-9]{1,24}$/.test(combo.code))
    return false;
  if (MODIFIER_CODE.test(combo.code)) return false;
  for (const flag of ["mod", "ctrl", "shift", "alt"])
    if (combo[flag] !== undefined && typeof combo[flag] !== "boolean")
      return false;
  return true;
}

/** Pages never get these: tabs and windows */
export const BROWSER_KEEPS = new Set([
  "M:KeyT",
  "M:KeyN",
  "M:KeyW",
  "MS:KeyT",
  "MS:KeyN",
  "MS:KeyW",
  "M:Tab",
  "MS:Tab",
  ":F11",
]);
/** Select all, copy, paste, cut, undo, redo: typing needs them */
const EDITING = /^M:Key[ACVXZY]$/;
const PRINTABLE =
  /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash|IntlRo|IntlYen|Space)$/;
const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;

/**
 * Why a combination can't be a shortcut on this system: the browser keeps
 * it, or typing needs it (plain keys, editing keys, AltGr on Windows,
 * Option+key on a Mac). Also used on synced data, so a combination written
 * on another system never breaks typing here.
 */
export function unusable(
  combo: Combo,
  mac: boolean,
): "browser" | "typing" | undefined {
  const c = normalize(combo, mac);
  const key = keyOf(c, mac);
  if (BROWSER_KEEPS.has(key)) return "browser";
  if (!c.mod && !c.ctrl && !c.alt && !FUNCTION_KEY.test(c.code))
    return "typing";
  if (EDITING.test(key)) return "typing";
  if (
    PRINTABLE.test(c.code) &&
    ((!mac && c.mod && c.alt) || (mac && c.alt && !c.mod && !c.ctrl))
  )
    return "typing";
}

/**
 * Only known ids with usable combinations for this system, written the
 * short way
 */
export function cleanCustom(input: unknown, mac: boolean): CustomCombos {
  const out: CustomCombos = {};
  if (!input || typeof input !== "object") return out;
  for (const [id, combo] of Object.entries(input as Record<string, unknown>)) {
    if (!isShortcutId(id) || !validCombo(combo)) continue;
    // as written (a Mac's Control stays Control for the Mac)
    const short: Combo = { code: combo.code };
    for (const flag of ["mod", "ctrl", "shift", "alt"] as const)
      if (combo[flag]) short[flag] = true;
    // a shortcut's own default is always fine
    if (
      keyOf(short, mac) !== keyOf(defaultCombo(id, mac), mac) &&
      unusable(short, mac)
    )
      continue;
    out[id] = short;
  }
  return out;
}

/**
 * Build the lookup table once (when the settings change, not per key press).
 * A person's own combination wins over a default that has the same keys;
 * the pair is kept in `conflicts` so the shortcuts screen can say so.
 */
export function compileKeymap(custom: CustomCombos, mac: boolean): Keymap {
  const clean = cleanCustom(custom, mac);
  const byId = {} as Record<ShortcutId, Combo>;
  const byCombo = new Map<string, ShortcutId>();
  const conflicts = new Map<ShortcutId, ShortcutId>();
  for (const id of REMAPPABLE) byId[id] = clean[id] ?? defaultCombo(id, mac);
  // defaults first, then the person's own on top
  const ids = [
    ...REMAPPABLE.filter((id) => !clean[id]),
    ...REMAPPABLE.filter((id) => clean[id]),
  ];
  for (const id of ids) {
    const key = keyOf(byId[id], mac);
    const other = byCombo.get(key);
    if (other) {
      conflicts.set(id, other);
      conflicts.set(other, id);
    }
    byCombo.set(key, id);
  }
  return {
    byCombo,
    byId,
    custom: new Set(Object.keys(clean) as ShortcutId[]),
    conflicts,
    slashDefault: !clean.open_shortcuts,
  };
}

// the keybinds store compiles with this from now on
setCompiler(compileKeymap);
