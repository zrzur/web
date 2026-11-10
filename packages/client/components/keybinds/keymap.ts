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
export const EDITING = /^M:Key[ACVXZY]$/;
export const PRINTABLE =
  /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash|IntlRo|IntlYen|Space)$/;
export const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;

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
    const short: Combo = { code: combo.code };
    if (combo.mod) short.mod = true;
    if (combo.ctrl) short.ctrl = true;
    if (combo.shift) short.shift = true;
    if (combo.alt) short.alt = true;
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

/** The combination as `aria-keyshortcuts` writes it, e.g. "Control+Shift+9" */
export function ariaKeys(combo: Combo, mac: boolean): string {
  const c = normalize(combo, mac);
  return [
    c.ctrl && "Control",
    c.mod && (mac ? "Meta" : "Control"),
    c.alt && "Alt",
    c.shift && "Shift",
    c.code.replace(/^(Key|Digit)/, ""),
  ]
    .filter(Boolean)
    .join("+");
}

export type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
> & { key?: string; isComposing?: boolean };

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
  const mod = mac ? event.metaKey : event.ctrlKey;
  if (mod && !event.altKey && event.key === "/")
    return map.slashDefault ? "open_shortcuts" : undefined;
  return hit;
}
