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
 * Each system has its own full set: macOS, Windows and Linux. A default is
 * written "windows|mac|linux"; an empty or missing part is the Windows one.
 * Option is the Mac's Alt key (the same `altKey` flag).
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

/** The system whose conventions and reserved keys apply */
export type Platform = "mac" | "windows" | "linux";

/**
 * A system: one of the three, or the older form `true` = Mac,
 * `false` = Windows (tests and callers that only care about Command)
 */
export type Sys = Platform | boolean;

/** The system a `Sys` stands for */
export function platformOf(sys: Sys): Platform {
  return sys === true ? "mac" : sys === false ? "windows" : sys;
}

/** Whether Command takes the place of Ctrl on this system */
export function macOf(sys: Sys): boolean {
  return sys === true || sys === "mac";
}

export type ShortcutId =
  | "toggle_mute"
  | "toggle_deafen"
  | "create_poll"
  | "navigation_channel_up"
  | "navigation_channel_down"
  | "navigation_server_up"
  | "navigation_server_down"
  | "navigation_unread_up"
  | "navigation_unread_down"
  | "chat_mark_server_as_read"
  | "open_events"
  | "toggle_streamer"
  | "toggle_soundboard"
  | "view_saved"
  | "view_reminders"
  | "save_clip"
  | "open_shortcuts"
  | "upload_file"
  | "open_emoji_picker"
  | "search_channel"
  | "view_mentions"
  | "leave_call"
  | "open_quick_switcher";

export type CustomCombos = Partial<Record<ShortcutId, Combo>>;

/**
 * Defaults as table keys, "windows|mac|linux" where a system differs. Not
 * Shift+7 for the poll (it types "/" on German, Spanish and Nordic
 * layouts); no browser uses Ctrl+Shift+L, and plugins can't take it
 * (RESERVED_KEYS). Every default is checked against the keys each system
 * and browser keep (keymapRules.test.ts).
 */
export const DEFAULTS: Record<ShortcutId, string> = {
  toggle_mute: "MS:KeyM",
  toggle_deafen: "MS:KeyD",
  create_poll: "MS:Digit8",
  navigation_channel_up: "A:ArrowUp",
  navigation_channel_down: "A:ArrowDown",
  // Linux: Ctrl+Alt+arrows switch workspaces on GNOME, KDE and others
  navigation_server_up: "MA:ArrowUp||A:PageUp",
  navigation_server_down: "MA:ArrowDown||A:PageDown",
  navigation_unread_up: "AS:ArrowUp",
  navigation_unread_down: "AS:ArrowDown",
  chat_mark_server_as_read: "S:Escape",
  open_events: "MS:Digit9",
  toggle_streamer: "MS:KeyL",
  toggle_soundboard: "MS:Digit6|MC:KeyS",
  // not Shift+7: it types "/" on German and Nordic layouts and is Ctrl+/
  // there. On a Mac, Command+Shift+4 and 5 take screenshots.
  view_saved: "MS:Digit4|MC:KeyB",
  view_reminders: "MS:Digit5|MC:KeyR",
  save_clip: "MS:Digit3|MC:KeyK",
  open_shortcuts: "M:Slash",
  // Linux: Ctrl+Shift+U starts a Unicode character in IBus (GNOME)
  upload_file: "MS:KeyU||MA:KeyU",
  open_emoji_picker: "M:KeyE",
  search_channel: "M:KeyF",
  // not Ctrl+I (italic in the message box), and not Ctrl+Shift+<digit>: the
  // desktop app's talk-from-other-apps key is Ctrl+Shift+<talk key>, and F
  // can never be a talk key there (globalTalk.ts, NOT_GLOBAL)
  view_mentions: "MS:KeyF|MC:KeyI",
  leave_call: "MS:KeyH",
  // the browser's search-bar key, taken while Zrzur is open
  open_quick_switcher: "M:KeyK",
};

/** Shortcuts that can be changed, in the order the shortcuts screen shows them */
export const REMAPPABLE = Object.keys(DEFAULTS) as ShortcutId[];

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
export function defaultCombo(id: ShortcutId, sys: Sys): Combo {
  const [windows, mac, linux] = DEFAULTS[id].split("|");
  const platform = platformOf(sys);
  return parse(
    (platform === "mac" && mac) || (platform === "linux" && linux) || windows,
  );
}

/** The same combination with only the fields that are set, for this system */
export function normalize(combo: Combo, sys: Sys): Combo {
  return parse(keyOf(combo, sys));
}

/** The table key for a combination on this system */
export function keyOf(c: Combo, sys: Sys) {
  const mac = macOf(sys);
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
export function defaultTable(mac: Sys): Keymap {
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
> & { key?: string; isComposing?: boolean; keyCode?: number };

export const MODIFIER_CODE = /^(Control|Meta|Shift|Alt|OS)(Left|Right)?$/;

/** The combination of a key press, or undefined when it can't be one */
export function eventCombo(event: KeyLike, sys: Sys): Combo | undefined {
  const mac = macOf(sys);
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
  sys: Sys,
): ShortcutId | undefined {
  const mac = macOf(sys);
  // a character being composed (Chinese, Japanese input) is never a
  // shortcut; some browsers say so only with key code 229
  if (event.isComposing || event.keyCode === 229) return;
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
