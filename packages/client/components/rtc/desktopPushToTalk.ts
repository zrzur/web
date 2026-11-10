import { activeKeymap, deviceMac } from "../keybinds/active";
import { matchShortcut } from "../keybinds/keymap";

/**
 * Push to talk from other apps, offered by the desktop app (preload
 * `window.native.pushToTalk`). Electron's global shortcuts report a press
 * but no release, so the desktop app offers a toggle: Ctrl+Shift (⌘⇧ on a
 * Mac) with the push-to-talk key turns talking on, the next press off.
 */
export interface DesktopPushToTalk {
  /** Take the combination for this key (false: unknown key, or another app has it) */
  register(code: string): Promise<boolean>;
  /** Give the combination back */
  unregister(): void;
  /** Called on every press of the combination; returns an unsubscribe */
  onToggle(callback: () => void): () => void;
}

/** The desktop bridge, or undefined in a browser and in older desktop apps */
export function desktopPushToTalk(): DesktopPushToTalk | undefined {
  if (typeof window === "undefined") return undefined;
  const bridge = (
    window as unknown as {
      native?: { pushToTalk?: Partial<DesktopPushToTalk> };
    }
  ).native?.pushToTalk;
  if (
    bridge &&
    typeof bridge.register === "function" &&
    typeof bridge.unregister === "function" &&
    typeof bridge.onToggle === "function"
  )
    return bridge as DesktopPushToTalk;
  return undefined;
}

/**
 * Keys the desktop app never takes with Ctrl/Cmd+Shift, because other apps
 * use those combinations for editing and moving around (the desktop app's
 * pushToTalkKeys.ts refuses the same list; this one only explains it here)
 */
const NOT_GLOBAL =
  /^(Key[ACFNTVWXZ]|Arrow(Up|Down|Left|Right)|Space|Home|End|PageUp|PageDown)$/;

/**
 * Why this push-to-talk key can't also talk from other apps: other apps use
 * Ctrl/Cmd+Shift with it for editing, or it is one of Zrzur's own shortcuts
 * (the person's own keys included), which a global shortcut would take from
 * the window.
 */
export function globalTalkBlock(code: string): "editing" | "app" | undefined {
  if (NOT_GLOBAL.test(code)) return "editing";
  const mac = deviceMac();
  // the table itself, also while a new combination is being recorded
  const taken = matchShortcut(
    activeKeymap(mac),
    { code, ctrlKey: !mac, metaKey: mac, shiftKey: true, altKey: false },
    mac,
  );
  return taken ? "app" : undefined;
}

/** Whether this push-to-talk key can also talk from other apps */
export function globalTalkAllowed(code: string): boolean {
  return !globalTalkBlock(code);
}

/**
 * A press of the global toggle. While muted or deafened nothing turns on;
 * the mute sound says why nothing happened.
 */
export function latchPress(
  latched: boolean,
  canTalk: boolean,
): { latched: boolean; sound: "mute" | "unmute" } {
  if (!canTalk || latched) return { latched: false, sound: "mute" };
  return { latched: true, sound: "unmute" };
}
