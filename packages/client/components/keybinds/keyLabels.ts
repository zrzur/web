/**
 * Key names for the screens that show shortcuts (they load on demand, so
 * these names stay out of the first download)
 */
import { type Combo, normalize } from "./keymap";

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
  Escape: "Esc",
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

/** How the global combination reads on this device, e.g. Ctrl+Shift+` */
export function globalPttCombo(code: string, mac: boolean): string {
  return comboLabel(["Mod", "Shift", keyLabel(code)], mac).join(mac ? "" : "+");
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
