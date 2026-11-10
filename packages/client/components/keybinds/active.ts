/**
 * The keymap in use now. Key listeners anywhere in the app ask here; the
 * keybinds store binds its compiled table once it has loaded. Until then
 * (and in tests) the defaults apply.
 */
import {
  type Keymap,
  type ShortcutId,
  compileKeymap,
  matchShortcut,
} from "./keymap";
import { isMac } from "./shortcuts";

const defaults: Partial<Record<"mac" | "other", Keymap>> = {};

/** The default table for this system, built once */
export function defaultKeymap(mac: boolean): Keymap {
  const slot = mac ? "mac" : "other";
  return (defaults[slot] ??= compileKeymap({}, mac));
}

let source: (mac: boolean) => Keymap = defaultKeymap;

/** Use this table from now on (the keybinds store calls this) */
export function bindKeymap(next: (mac: boolean) => Keymap) {
  source = next;
}

/** Back to the defaults (tests) */
export function unbindKeymap() {
  source = defaultKeymap;
}

/** The table for this system */
export function activeKeymap(mac: boolean = deviceMac()): Keymap {
  return source(mac);
}

let mac: boolean | undefined;
/** Whether this device uses Command, read once */
export function deviceMac() {
  return (mac ??= isMac());
}

type KeyLike = Parameters<typeof matchShortcut>[1];

let recording = 0;
/**
 * While a new combination is being recorded, no shortcut runs (the press is
 * the new combination, not a command). Returns the function that ends it.
 */
export function pauseShortcuts(): () => void {
  recording++;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    recording--;
  };
}

/** Whether a new combination is being recorded now */
export function shortcutsPaused() {
  return recording > 0;
}

/** Which app shortcut this key press is, with the person's own keys */
export function shortcutFor(
  event: KeyLike,
  isMacDevice: boolean = deviceMac(),
): ShortcutId | undefined {
  if (recording) return undefined;
  return matchShortcut(activeKeymap(isMacDevice), event, isMacDevice);
}
