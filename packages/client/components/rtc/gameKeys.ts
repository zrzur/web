/**
 * Keys that work in games: push to talk, push to mute, mute and deafen
 * from any app. The desktop app hears the person's binds system-wide
 * (preload `window.native.globalKeys`); a browser cannot, so there these
 * binds do nothing and the settings say so.
 *
 * This file is the part with no screen: what a bind is, how it is written
 * and checked, the bridge, and when the microphone opens and closes.
 */

export type GameKeyAction = "talk" | "mute" | "toggleMute" | "toggleDeafen";

export const GAME_KEY_ACTIONS: readonly GameKeyAction[] = [
  "talk",
  "mute",
  "toggleMute",
  "toggleDeafen",
];

/**
 * A physical key (`KeyboardEvent.code`) or a mouse button ("Mouse3" middle,
 * "Mouse4" / "Mouse5" side buttons), with modifiers. A modifier alone can
 * be a bind ("ControlRight").
 */
export type GameBind = {
  code: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

export type GameBinds = Partial<Record<GameKeyAction, GameBind>>;

const MODIFIER = /^(Control|Alt|Shift|Meta)(Left|Right)$/;
const MOUSE = /^Mouse[345]$/;
/** Keys that type something: never a switch on their own */
const TYPING =
  /^(Key[A-Z]|Digit[0-9]|Space|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|CapsLock|Arrow(Up|Down|Left|Right)|Delete)$/;
/** Keys that keep their own job everywhere */
const NEVER = /^(Escape|Tab|Enter|NumpadEnter|Backspace)$/;
const KNOWN =
  /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Numpad(Multiply|Add|Subtract|Decimal|Divide)|F([1-9]|1[0-9]|2[0-4])|Space|CapsLock|PageUp|PageDown|End|Home|Arrow(Left|Up|Right|Down)|Insert|Delete|Semicolon|Equal|Comma|Minus|Period|Slash|Backquote|BracketLeft|Backslash|BracketRight|Quote|ScrollLock)$/;

const FLAGS = ["ctrl", "alt", "shift", "meta"] as const;
const FLAG_NAMES = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Meta" };

/** Whether this can be the main key of a bind at all */
export function bindCodeKnown(code: string) {
  return KNOWN.test(code) || MODIFIER.test(code) || MOUSE.test(code);
}

/** The modifier a modifier key is itself */
function ownFlag(code: string): (typeof FLAGS)[number] | undefined {
  const m = MODIFIER.exec(code);
  return m
    ? ({ Control: "ctrl", Alt: "alt", Shift: "shift", Meta: "meta" } as const)[
        m[1] as "Control" | "Alt" | "Shift" | "Meta"
      ]
    : undefined;
}

/** The same bind with only what matters set (a modifier never needs itself) */
export function normalizeBind(bind: GameBind): GameBind {
  const out: GameBind = { code: bind.code };
  const own = ownFlag(bind.code);
  for (const flag of FLAGS) if (bind[flag] && flag !== own) out[flag] = true;
  return out;
}

/** A bind as stored: "Ctrl+Shift+KeyV", "Mouse4", "ControlRight" */
export function formatBind(bind: GameBind): string {
  const b = normalizeBind(bind);
  return [...FLAGS.filter((f) => b[f]).map((f) => FLAG_NAMES[f]), b.code].join(
    "+",
  );
}

/** A stored bind back, or undefined when it is not one */
export function parseBind(text: unknown): GameBind | undefined {
  if (typeof text !== "string" || !text || text.length > 64) return undefined;
  const parts = text.split("+");
  const code = parts.pop()!;
  if (!bindCodeKnown(code)) return undefined;
  const bind: GameBind = { code };
  for (const part of parts) {
    const flag = FLAGS.find((f) => FLAG_NAMES[f] === part);
    if (!flag || bind[flag]) return undefined;
    bind[flag] = true;
  }
  return normalizeBind(bind);
}

export function sameBind(a: GameBind | undefined, b: GameBind | undefined) {
  return !!a && !!b && formatBind(a) === formatBind(b);
}

/** Whether the bind is one plain key: no modifier with it, not a modifier, not the mouse */
export function plainKey(bind: GameBind) {
  const b = normalizeBind(bind);
  return (
    !FLAGS.some((f) => b[f]) && !MODIFIER.test(b.code) && !MOUSE.test(b.code)
  );
}

const HELD = new Set<GameKeyAction>(["talk", "mute"]);

/** Whether the action lasts as long as the key is held */
export const heldAction = (action: GameKeyAction) => HELD.has(action);

export type BindProblem =
  /** Esc, Tab, Enter, Backspace keep their own job */
  | "reserved"
  /** a switch on a key that types would fire while writing in any app */
  | "typing"
  /** another of these actions has it */
  | { clash: GameKeyAction };

/**
 * Whether this bind can be used for the action, next to the other binds
 */
export function checkBind(
  action: GameKeyAction,
  bind: GameBind,
  others: GameBinds,
): BindProblem | undefined {
  const b = normalizeBind(bind);
  if (!bindCodeKnown(b.code) || NEVER.test(b.code)) return "reserved";
  if (!HELD.has(action) && plainKey(b) && TYPING.test(b.code)) return "typing";
  for (const other of GAME_KEY_ACTIONS)
    if (other !== action && sameBind(others[other], b)) return { clash: other };
  return undefined;
}

type KeyPress = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
>;

/**
 * While recording: what a key going down means. A modifier waits (it may
 * be the start of a combination); Esc cancels.
 */
export function readBindKey(event: KeyPress): GameBind | "cancel" | "wait" {
  if (MODIFIER.test(event.code)) return "wait";
  if (
    event.code === "Escape" &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !event.metaKey
  )
    return "cancel";
  if (!bindCodeKnown(event.code) && !NEVER.test(event.code)) return "wait";
  return normalizeBind({
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  });
}

/**
 * While recording: a modifier let go with nothing else pressed is the bind
 * itself (the other modifiers still held come with it)
 */
export function readBindKeyUp(event: KeyPress): GameBind | undefined {
  if (!MODIFIER.test(event.code)) return undefined;
  return normalizeBind({
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  });
}

/** While recording: a mouse button (`MouseEvent.button`), if it can be a bind */
export function readBindMouse(
  event: Pick<
    MouseEvent,
    "button" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
  >,
): GameBind | undefined {
  const code = { 1: "Mouse3", 3: "Mouse4", 4: "Mouse5" }[event.button];
  if (!code) return undefined;
  return normalizeBind({
    code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  });
}

/** Key caps of a bind's own key (names printed on keys are not translated) */
export function bindKeyName(code: string): string | undefined {
  const modifier = MODIFIER.exec(code);
  if (modifier) {
    const name = { Control: "Ctrl", Alt: "Alt", Shift: "Shift", Meta: "Meta" }[
      modifier[1] as "Control" | "Alt" | "Shift" | "Meta"
    ];
    return modifier[2] === "Right" ? `Right ${name}` : name;
  }
  const mouse = /^Mouse([345])$/.exec(code);
  if (mouse) return `Mouse ${mouse[1]}`;
  return undefined;
}

/**
 * Key caps for a bind, in the words `comboLabel` understands ("Mod" is not
 * used: these binds name the real key, so Ctrl stays Ctrl on a Mac)
 */
export function bindCaps(
  bind: GameBind,
  keyLabel: (code: string) => string,
): string[] {
  const b = normalizeBind(bind);
  return [
    ...FLAGS.filter((f) => b[f]).map((f) => FLAG_NAMES[f]),
    bindKeyName(b.code) ?? keyLabel(b.code),
  ];
}

// ------------------------------------------------------------------ settings

/** Choices for "keep the microphone open after the key is let go" (ms) */
export const RELEASE_DELAYS = [0, 100, 200, 300, 500, 1000, 2000] as const;
export const DEFAULT_RELEASE_DELAY = 200;

export function cleanReleaseDelay(value: unknown): number {
  return typeof value === "number" && value >= 0 && value <= 2000
    ? Math.round(value)
    : DEFAULT_RELEASE_DELAY;
}

/** Stored binds (text) checked and read; anything odd is dropped */
export function cleanStoredBinds(
  input: unknown,
): Partial<Record<GameKeyAction, string>> {
  const out: Partial<Record<GameKeyAction, string>> = {};
  if (!input || typeof input !== "object") return out;
  const seen: GameBinds = {};
  for (const action of GAME_KEY_ACTIONS) {
    const bind = parseBind((input as Record<string, unknown>)[action]);
    if (!bind || checkBind(action, bind, seen)) continue;
    seen[action] = bind;
    out[action] = formatBind(bind);
  }
  return out;
}

/**
 * The binds the desktop app listens for right now. Push to talk is the
 * person's game bind, else their push-to-talk key, and only in push-to-talk
 * mode; a bind another action already has is left out.
 */
export function activeBinds(settings: {
  inputMode: "voice" | "ptt";
  pttKey: string;
  binds: Partial<Record<GameKeyAction, string>>;
}): GameBinds {
  const out: GameBinds = {};
  for (const action of ["mute", "toggleMute", "toggleDeafen"] as const) {
    const bind = parseBind(settings.binds[action]);
    if (bind) out[action] = bind;
  }
  if (settings.inputMode === "ptt") {
    const talk =
      parseBind(settings.binds.talk) ?? parseBind(settings.pttKey) ?? undefined;
    if (talk && !checkBind("talk", talk, out)) out.talk = talk;
  }
  return out;
}

// -------------------------------------------------------------------- bridge

export type GameKeysState = "ready" | "on" | "permission" | "error";

export interface GameKeysStatus {
  state: GameKeysState;
  platform: string;
  wayland: boolean;
  detail?: string;
}

export interface DesktopGameKeys {
  status(): Promise<GameKeysStatus | undefined>;
  set(binds: GameBinds): Promise<GameKeysStatus | undefined>;
  clear(): void;
  askPermission(): Promise<GameKeysStatus | undefined>;
  /** `focused`: whether the Zrzur window was in front, as the system sees it */
  onEvent(
    callback: (action: string, down: boolean, focused?: boolean) => void,
  ): () => void;
  onStatus(callback: (status: GameKeysStatus) => void): () => void;
}

/** The desktop bridge, or undefined in a browser and in older desktop apps */
export function desktopGameKeys(): DesktopGameKeys | undefined {
  if (typeof window === "undefined") return undefined;
  const bridge = (
    window as unknown as { native?: { globalKeys?: Partial<DesktopGameKeys> } }
  ).native?.globalKeys;
  if (
    bridge &&
    (
      [
        "status",
        "set",
        "clear",
        "askPermission",
        "onEvent",
        "onStatus",
      ] as const
    ).every((name) => typeof bridge[name] === "function")
  )
    return bridge as DesktopGameKeys;
  return undefined;
}

/** Whether the listener can hear keys on this device right now */
export function gameKeysUsable(status: GameKeysStatus | undefined) {
  return status?.state === "ready" || status?.state === "on";
}

/**
 * Whether a key heard by the desktop app is left to the page instead: the
 * Zrzur window is in front and the person is typing with a plain key, or
 * the page's own shortcut is on the same keys (it handles the press).
 */
export function leaveToPage(
  bind: GameBind,
  page: { focused: boolean; typing: boolean; ownShortcut: boolean },
): boolean {
  if (!page.focused) return false;
  if (page.ownShortcut) return true;
  return page.typing && plainKey(bind);
}
