/**
 * The app's shortcuts a person can change, as one lookup table. This file
 * is in the first download, so it holds only the defaults and the matching;
 * a person's own combinations are compiled by keymapCompile.ts, loaded
 * only when there are some (or with the shortcuts screen).
 *
 * A combination is a physical key (`KeyboardEvent.code`, so it stays the
 * same on Arabic, German or any other layout) plus modifiers. `mod` is the
 * main shortcut key: Ctrl, or Command on a Mac. `ctrl` is the Mac's Control
 * key; on other systems it is read as `mod`, so a combination synced from a
 * Mac still works on Windows. Written short as a table key: "MS:KeyM" is
 * Ctrl/Cmd+Shift+M (M mod, C Mac Control, S Shift, A Alt).
 *
 * Every key press is one `Map.get`: no scan over the list of shortcuts.
 */

export type Combo = {
  code: string;
  mod?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type ShortcutId =
  | "toggle_mute"
  | "toggle_deafen"
  | "create_poll"
  | "navigation_channel_up"
  | "navigation_channel_down"
  | "navigation_server_up"
  | "navigation_server_down"
  | "chat_mark_server_as_read"
  | "open_events"
  | "toggle_streamer"
  | "open_shortcuts";

export type CustomCombos = Partial<Record<ShortcutId, Combo>>;

/**
 * Defaults as table keys, "other|mac" where a Mac differs. Not Shift+7 for
 * the poll (it types "/" on German, Spanish and Nordic layouts); no browser
 * uses Ctrl+Shift+L, and plugins can't take it (RESERVED_KEYS).
 */
const DEFAULTS: Record<ShortcutId, string> = {
  toggle_mute: "MS:KeyM",
  toggle_deafen: "MS:KeyD",
  create_poll: "MS:Digit8",
  navigation_channel_up: "A:ArrowUp",
  navigation_channel_down: "A:ArrowDown",
  navigation_server_up: "MA:ArrowUp|CA:ArrowUp",
  navigation_server_down: "MA:ArrowDown|CA:ArrowDown",
  chat_mark_server_as_read: "S:Escape",
  open_events: "MS:Digit9",
  toggle_streamer: "MS:KeyL",
  open_shortcuts: "M:Slash",
};

/** Shortcuts that can be changed, in the order the shortcuts screen shows them */
export const REMAPPABLE = Object.keys(DEFAULTS) as ShortcutId[];

/** Whether this is a shortcut id this version knows */
export function isShortcutId(id: string): id is ShortcutId {
  return Object.prototype.hasOwnProperty.call(DEFAULTS, id);
}

/** A combination from its table key */
function parse(key: string): Combo {
  const [flags, code] = key.split(":");
  const c: Combo = { code };
  if (flags.includes("M")) c.mod = true;
  if (flags.includes("C")) c.ctrl = true;
  if (flags.includes("S")) c.shift = true;
  if (flags.includes("A")) c.alt = true;
  return c;
}

/** The combination a shortcut has when nobody changed it */
export function defaultCombo(id: ShortcutId, mac: boolean): Combo {
  const [other, onMac] = DEFAULTS[id].split("|");
  return parse((mac && onMac) || other);
}

/** The same combination with only the fields that are set, for this system */
export function normalize(combo: Combo, mac: boolean): Combo {
  return parse(keyOf(combo, mac));
}

/** The table key for a combination on this system */
export function keyOf(c: Combo, mac: boolean) {
  const mod = c.mod || (!mac && c.ctrl);
  return `${mod ? "M" : ""}${mac && c.ctrl ? "C" : ""}${c.shift ? "S" : ""}${c.alt ? "A" : ""}:${c.code}`;
}

export type Keymap = {
  /** Table key of a combination to the shortcut that has it */
  byCombo: Map<string, ShortcutId>;
  /** The combination each shortcut has now */
  byId: Record<ShortcutId, Combo>;
  /** Shortcuts the person changed */
  custom: Set<ShortcutId>;
  /**
   * Shortcuts on the same keys as another one on this system (synced from
   * a device where they differed), both ways
   */
  conflicts: Map<ShortcutId, ShortcutId>;
  /** Whether Ctrl+/ is still the default (then it also matches by the "/" character) */
  slashDefault: boolean;
};

/** The table with every default, for this system */
export function defaultTable(mac: boolean): Keymap {
  const byId = {} as Record<ShortcutId, Combo>;
  const byCombo = new Map<string, ShortcutId>();
  for (const id of REMAPPABLE) {
    byId[id] = defaultCombo(id, mac);
    byCombo.set(keyOf(byId[id], mac), id);
  }
  return {
    byCombo,
    byId,
    custom: new Set(),
    conflicts: new Map(),
    slashDefault: true,
  };
}

export type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
> & { key?: string; isComposing?: boolean };

export const MODIFIER_CODE = /^(Control|Meta|Shift|Alt|OS)(Left|Right)?$/;

/** The combination of a key press, or undefined when it can't be one */
export function eventCombo(event: KeyLike, mac: boolean): Combo | undefined {
  // the Windows key belongs to the system
  if (!event.code || MODIFIER_CODE.test(event.code) || (!mac && event.metaKey))
    return;
  return normalize(
    {
      code: event.code,
      mod: mac ? event.metaKey : event.ctrlKey,
      ctrl: mac && event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
    },
    mac,
  );
}

/**
 * Which shortcut this key press is, if any. The person's own combination
 * is looked up first; on a miss or a default hit, a Ctrl press that types
 * "/" is Ctrl+/ (German, Spanish, Italian and Nordic layouts: Shift+7).
 * @param mac Whether Command takes the place of Ctrl
 */
export function matchShortcut(
  map: Keymap,
  event: KeyLike,
  mac: boolean,
): ShortcutId | undefined {
  // a character being composed (Chinese, Japanese input) is never a shortcut
  if (event.isComposing) return;
  const combo = eventCombo(event, mac);
  const hit = combo && map.byCombo.get(keyOf(combo, mac));
  if (hit && map.custom.has(hit)) return hit;
  if (
    (mac ? event.metaKey : event.ctrlKey) &&
    !event.altKey &&
    event.key === "/"
  )
    return map.slashDefault ? "open_shortcuts" : undefined;
  return hit;
}
