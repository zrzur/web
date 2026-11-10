/**
 * The app's shortcuts a person can change, compiled into one lookup table.
 *
 * A combination is a physical key (`KeyboardEvent.code`, so it stays the
 * same on Arabic, German or any other layout) plus modifiers. `mod` is the
 * main shortcut key: Ctrl, or Command on a Mac. `ctrl` is the Mac's Control
 * key; on other systems it is read as `mod`, so a combination synced from a
 * Mac still works on Windows.
 *
 * Every key press is one `Map.get`: no scan over the list of shortcuts.
 */
import { keyLabel } from "./shortcuts";

export type Combo = {
  code: string;
  mod?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

/** Shortcuts that can be changed, in the order the shortcuts screen shows them */
export const REMAPPABLE = [
  "toggle_mute",
  "toggle_deafen",
  "create_poll",
  "navigation_channel_up",
  "navigation_channel_down",
  "navigation_server_up",
  "navigation_server_down",
  "chat_mark_server_as_read",
  "open_events",
  "toggle_streamer",
  "open_shortcuts",
] as const;

export type ShortcutId = (typeof REMAPPABLE)[number];

export type CustomCombos = Partial<Record<ShortcutId, Combo>>;

const DEFAULTS: Record<ShortcutId, { other: Combo; mac?: Combo }> = {
  toggle_mute: { other: { code: "KeyM", mod: true, shift: true } },
  toggle_deafen: { other: { code: "KeyD", mod: true, shift: true } },
  // not Shift+7: that types "/" on German, Spanish and Nordic layouts
  create_poll: { other: { code: "Digit8", mod: true, shift: true } },
  navigation_channel_up: { other: { code: "ArrowUp", alt: true } },
  navigation_channel_down: { other: { code: "ArrowDown", alt: true } },
  navigation_server_up: {
    other: { code: "ArrowUp", mod: true, alt: true },
    mac: { code: "ArrowUp", ctrl: true, alt: true },
  },
  navigation_server_down: {
    other: { code: "ArrowDown", mod: true, alt: true },
    mac: { code: "ArrowDown", ctrl: true, alt: true },
  },
  chat_mark_server_as_read: { other: { code: "Escape", shift: true } },
  open_events: { other: { code: "Digit9", mod: true, shift: true } },
  // no browser uses Ctrl+Shift+L, and plugins can't take it (RESERVED_KEYS)
  toggle_streamer: { other: { code: "KeyL", mod: true, shift: true } },
  open_shortcuts: { other: { code: "Slash", mod: true } },
};

const IDS = new Set<string>(REMAPPABLE);

/** Whether this is a shortcut id this version knows */
export function isShortcutId(id: string): id is ShortcutId {
  return IDS.has(id);
}

/** The combination a shortcut has when nobody changed it */
export function defaultCombo(id: ShortcutId, mac: boolean): Combo {
  const entry = DEFAULTS[id];
  return (mac && entry.mac) || entry.other;
}

/** The same combination with only the fields that are set, for this system */
export function normalize(combo: Combo, mac: boolean): Combo {
  const out: Combo = { code: combo.code };
  const mod = !!combo.mod || (!mac && !!combo.ctrl);
  if (mod) out.mod = true;
  if (mac && combo.ctrl) out.ctrl = true;
  if (combo.shift) out.shift = true;
  if (combo.alt) out.alt = true;
  return out;
}

/** The table key for a combination */
export function keyOf(combo: Combo, mac: boolean) {
  const c = normalize(combo, mac);
  return `${c.mod ? "M" : ""}${c.ctrl ? "C" : ""}${c.shift ? "S" : ""}${c.alt ? "A" : ""}:${c.code}`;
}

/** Whether two combinations are the same keys */
export function sameCombo(a: Combo | undefined, b: Combo | undefined) {
  if (!a || !b) return false;
  // compared as written for both systems: a Mac's Control equals Ctrl only off a Mac
  return (
    keyOf(a, false) === keyOf(b, false) && keyOf(a, true) === keyOf(b, true)
  );
}

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

/** Only known ids with usable combinations, written the short way */
export function cleanCustom(input: unknown): CustomCombos {
  const out: CustomCombos = {};
  if (!input || typeof input !== "object") return out;
  for (const [id, combo] of Object.entries(input as Record<string, unknown>)) {
    if (!isShortcutId(id) || !validCombo(combo)) continue;
    const short: Combo = { code: combo.code };
    if (combo.mod) short.mod = true;
    if (combo.ctrl) short.ctrl = true;
    if (combo.shift) short.shift = true;
    if (combo.alt) short.alt = true;
    out[id] = short;
  }
  return out;
}

export type Keymap = {
  /** Table key of a combination to the shortcut that has it */
  byCombo: Map<string, ShortcutId>;
  /** The combination each shortcut has now */
  byId: Record<ShortcutId, Combo>;
  /** Whether Ctrl+/ is still the default (then it also matches by the "/" character) */
  slashDefault: boolean;
};

/**
 * Build the lookup table once (when the settings change, not per key press).
 * A person's own combination wins over a default that has the same keys.
 */
export function compileKeymap(custom: CustomCombos, mac: boolean): Keymap {
  const clean = cleanCustom(custom);
  const byId = {} as Record<ShortcutId, Combo>;
  const byCombo = new Map<string, ShortcutId>();
  for (const id of REMAPPABLE) byId[id] = clean[id] ?? defaultCombo(id, mac);
  // defaults first, then the person's own on top
  for (const id of REMAPPABLE)
    if (!clean[id]) byCombo.set(keyOf(byId[id], mac), id);
  for (const id of REMAPPABLE)
    if (clean[id]) byCombo.set(keyOf(byId[id], mac), id);
  return {
    byCombo,
    byId,
    slashDefault: !clean.open_shortcuts,
  };
}

export type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
> & { key?: string };

export const MODIFIER_CODE = /^(Control|Meta|Shift|Alt|OS)(Left|Right)?$/;

/** The combination of a key press, or undefined when it can't be one */
export function eventCombo(event: KeyLike, mac: boolean): Combo | undefined {
  if (!event.code || MODIFIER_CODE.test(event.code)) return;
  // the Windows key belongs to the system
  if (!mac && event.metaKey) return;
  const combo: Combo = { code: event.code };
  if (mac ? event.metaKey : event.ctrlKey) combo.mod = true;
  if (mac && event.ctrlKey) combo.ctrl = true;
  if (event.shiftKey) combo.shift = true;
  if (event.altKey) combo.alt = true;
  return combo;
}

/**
 * Which shortcut this key press is, if any
 * @param mac Whether Command takes the place of Ctrl
 */
export function matchShortcut(
  map: Keymap,
  event: KeyLike,
  mac: boolean,
): ShortcutId | undefined {
  const mod = mac ? event.metaKey : event.ctrlKey;
  // Ctrl+/ by the character: on German, Spanish, Italian and Nordic layouts
  // "/" is Shift+7; a press that types "/" is never another shortcut
  if (mod && !event.altKey && event.key === "/")
    return map.slashDefault ? "open_shortcuts" : undefined;
  const combo = eventCombo(event, mac);
  return combo && map.byCombo.get(keyOf(combo, mac));
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
  return { ...cleanCustom(custom), [id]: combo, [other]: map.byId[id] };
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
