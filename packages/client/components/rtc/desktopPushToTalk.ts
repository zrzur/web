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
