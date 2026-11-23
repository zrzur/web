/**
 * The keymap in use now. Key listeners anywhere in the app ask here; the
 * keybinds store binds its compiled table once it has loaded. Until then
 * (and in tests) the defaults apply.
 */
import { createSignal } from "solid-js";

import {
  type CustomCombos,
  type Keymap,
  type Platform,
  type ShortcutId,
  type Sys,
  defaultTable,
  matchShortcut,
  platformOf,
} from "./keymap";
import { detectPlatform, isTypingTarget } from "./shortcuts";

const defaults: Partial<Record<Platform, Keymap>> = {};

/** The default table for this system, built once */
export function defaultKeymap(sys: Sys): Keymap {
  const slot = platformOf(sys);
  return (defaults[slot] ??= defaultTable(slot));
}

type Compile = (custom: CustomCombos, sys: Sys) => Keymap;
const [compiler, setCompilerSignal] = createSignal<Compile>();
/** The compiler for a person's own shortcuts, once keymapCompile.ts loaded */
export { compiler };
/** keymapCompile.ts registers itself here when it loads */
export function setCompiler(compile: Compile) {
  setCompilerSignal(() => compile);
}

let source: (sys: Sys) => Keymap = defaultKeymap;

/** Use this table from now on (the keybinds store calls this) */
export function bindKeymap(next: (sys: Sys) => Keymap) {
  source = next;
}

/** The table for this system */
export function activeKeymap(sys: Sys = devicePlatform()): Keymap {
  return source(sys);
}

let platform: Platform | undefined;
/** This device's system (macOS, Windows or Linux), read once */
export function devicePlatform(): Platform {
  return (platform ??= detectPlatform());
}

/** Whether this device uses Command */
export function deviceMac() {
  return devicePlatform() === "mac";
}

type KeyLike = Parameters<typeof matchShortcut>[1] & {
  target?: EventTarget | null;
};

let recording = 0;
/**
 * While a new combination is being recorded, no shortcut runs (the press is
 * the new combination, not a command). Returns the function that ends it.
 */
export function pauseShortcuts(): () => void {
  recording++;
  let ended = false;
  return () => {
    if (!ended) recording--;
    ended = true;
  };
}

/** Whether a new combination is being recorded now */
export const shortcutsPaused = () => recording > 0;

/** Which app shortcut this key press is, with the person's own keys */
export function shortcutFor(
  event: KeyLike,
  sys: Sys = devicePlatform(),
): ShortcutId | undefined {
  if (recording) return undefined;
  const map = activeKeymap(sys);
  const id = matchShortcut(map, event, sys);
  // in a text field only combinations with Ctrl, Cmd or Alt act; the key
  // itself goes to the text (and nothing is prevented)
  if (id && event.target && isTypingTarget(event.target)) {
    const c = map.byId[id];
    if (!c.mod && !c.ctrl && !c.alt) return undefined;
  }
  return id;
}
