/**
 * Which push-to-talk keys can also talk from other apps (desktop app).
 * Loaded with the voice runtime (a call) and with voice settings, not with
 * the app.
 */
import { activeKeymap, deviceMac } from "../keybinds/active";
import { matchShortcut } from "../keybinds/keymap";

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
