/**
 * App-wide shortcuts that work on every screen (voice and help), plus the
 * key names shown in the shortcuts list. Keys are matched by their physical
 * position (`event.code`), so they stay the same on Arabic, German or any
 * other keyboard layout.
 *
 * The default combos are also in the plugin SDK's RESERVED_KEYS, so a
 * plugin can never take them over.
 */
import { shortcutFor } from "./active";
import type { Platform, Sys } from "./keymap";

export type GlobalShortcut =
  | "toggle_mute"
  | "toggle_deafen"
  | "open_shortcuts"
  | "toggle_streamer"
  | "toggle_soundboard"
  | "save_clip"
  | "leave_call";

type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
> & { key?: string };

/**
 * Which app-wide shortcut this key press is, if any (with the person's own
 * keys, see keymap.ts)
 * @param event Key press
 * @param mac Whether Command takes the place of Ctrl
 */
export function matchGlobalShortcut(
  event: KeyLike,
  sys: Sys,
): GlobalShortcut | undefined {
  const id = shortcutFor(event, sys);
  // the app-wide ones: toggle_mute, toggle_deafen, toggle_streamer,
  // toggle_soundboard, save_clip, open_shortcuts, leave_call
  return id && /^(toggle_|open_shortcuts|save_clip|leave_call)/.test(id)
    ? (id as GlobalShortcut)
    : undefined;
}

const NOT_TYPING_INPUTS = new Set([
  "button",
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "submit",
  "reset",
  "image",
]);

/**
 * Whether a key press goes into a text field (then push to talk and single
 * key shortcuts must leave it alone)
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement)
    return !NOT_TYPING_INPUTS.has(target.type);
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.nodeName === "MDUI-TEXT-FIELD"
  )
    return true;
  return (
    target.isContentEditable ||
    !!target.closest("[contenteditable]:not([contenteditable='false'])")
  );
}

export type VoiceInputMode = "voice" | "ptt";

/**
 * Whether the microphone may send sound right now
 * @param mode Voice activity (always) or push to talk (while held)
 * @param held Whether the push-to-talk key is down
 */
export function transmitting(mode: VoiceInputMode, held: boolean) {
  return mode === "voice" || held;
}

/** Keys that must keep their own job: leaving, moving focus, sending, modifiers */
const BLOCKED_PTT =
  /^(Escape|Tab|Enter|NumpadEnter|Backspace|(Control|Meta|Shift|Alt|OS)(Left|Right)?)$/;

/**
 * Whether a key can be used for push to talk
 */
export function pttKeyAllowed(code: string) {
  return !!code && !BLOCKED_PTT.test(code);
}

type PlatformSource = {
  /** `navigator.userAgentData.platform`: "macOS", "Windows", "Linux", … */
  uaPlatform?: string;
  /** `navigator.platform`: "MacIntel", "Win32", "Linux x86_64", … */
  platform?: string;
  userAgent?: string;
  /** The desktop app's `process.platform`: "darwin", "win32", "linux" */
  desktop?: string;
};

/**
 * Which system's shortcuts apply: the desktop app says so itself; in a
 * browser the client hints come first, then the older `navigator.platform`
 * and the user agent. iPhones and iPads use the Mac set (Command keys on
 * their keyboards); ChromeOS and anything unknown the Windows set.
 */
export function platformFrom(source: PlatformSource): Platform {
  const desktop = source.desktop;
  if (desktop === "darwin") return "mac";
  if (desktop === "win32") return "windows";
  if (desktop === "linux" || desktop === "freebsd" || desktop === "openbsd")
    return "linux";
  const text = [source.uaPlatform, source.platform, source.userAgent]
    .filter(Boolean)
    .join(" ");
  const first =
    (source.uaPlatform || source.platform || source.userAgent) ?? "";
  for (const probe of [first, text]) {
    if (/mac|iphone|ipad|ipod|ios/i.test(probe)) return "mac";
    if (/win/i.test(probe)) return "windows";
    if (/android|cros/i.test(probe)) return "windows";
    if (/linux|x11|bsd/i.test(probe)) return "linux";
  }
  return "windows";
}

/** This device's system, from what the browser or the desktop app tells */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows";
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const native =
    typeof window !== "undefined"
      ? (window as { native?: { platform?: unknown } }).native
      : undefined;
  const desktop =
    typeof native?.platform === "function"
      ? (native.platform as () => unknown)()
      : native?.platform;
  return platformFrom({
    desktop: typeof desktop === "string" ? desktop : undefined,
    uaPlatform: nav.userAgentData?.platform,
    platform: nav.platform,
    userAgent: nav.userAgent,
  });
}

/** Whether this device uses Command for shortcuts */
export const isMac = () => detectPlatform() === "mac";
