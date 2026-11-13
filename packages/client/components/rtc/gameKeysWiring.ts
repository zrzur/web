/**
 * Desktop app: the person's binds, heard while a game or another app is in
 * front, drive the call. Loaded only inside the desktop app.
 *
 * The desktop listens only while there is something to hear: during a call
 * (or while voice settings test the keys), with "Keys work in games" on and
 * at least one bind. It reports nothing but those binds going down and up.
 */
import { createEffect, onCleanup, untrack } from "solid-js";

import { activeKeymap, deviceMac, shortcutsPaused } from "../keybinds/active";
import { matchShortcut } from "../keybinds/keymap";
import { isTypingTarget } from "../keybinds/shortcuts";
import type { State } from "../state";

import {
  type GameBind,
  type GameBinds,
  type GameKeyAction,
  type GameKeysStatus,
  GAME_KEY_ACTIONS,
  activeBinds,
  cleanStoredBinds,
  desktopGameKeys,
  leaveToPage,
} from "./gameKeys";
import type { createTalkGate } from "./talkGate";

/** The parts of the call (rtc/state.tsx) used here */
export interface GameKeysCall {
  gameKeyTest(): boolean;
  setGameKeys(status: GameKeysStatus | undefined): void;
  noteGameKey(
    heard: { action: GameKeyAction; down: boolean; away: boolean } | undefined,
  ): void;
  setPushToMute(held: boolean): void;
  toggleMute(): unknown;
  toggleDeafen(): unknown;
}

/** Whether one of the page's own shortcuts is on the same keys */
function ownShortcut(bind: GameBind): boolean {
  const mac = deviceMac();
  return !!matchShortcut(
    activeKeymap(mac),
    {
      code: bind.code,
      ctrlKey: !!bind.ctrl,
      metaKey: !!bind.meta,
      shiftKey: !!bind.shift,
      altKey: !!bind.alt,
    },
    mac,
  );
}

export function wireGameKeys(options: {
  voice: GameKeysCall;
  state: Pick<State, "voice" | "keybinds">;
  talkGate: ReturnType<typeof createTalkGate>;
  inCall: () => boolean;
}) {
  const bridge = desktopGameKeys();
  if (!bridge) return;
  const { voice, state, talkGate, inCall } = options;
  let binds: GameBinds = {};
  let listening = false;

  const stopStatus = bridge.onStatus((status) => voice.setGameKeys(status));
  void bridge.status().then((status) => status && voice.setGameKeys(status));

  const stopEvents = bridge.onEvent((name, down, windowFocused) => {
    const action = name as GameKeyAction;
    const bind = binds[action];
    if (!GAME_KEY_ACTIONS.includes(action) || !bind) return;
    const focused =
      typeof windowFocused === "boolean" ? windowFocused : document.hasFocus();
    voice.noteGameKey({ action, down, away: !focused });

    if (!down) {
      if (action === "talk") talkGate.up("desktop");
      else if (action === "mute") voice.setPushToMute(false);
      return;
    }
    if (!inCall() || shortcutsPaused()) return;
    if (
      leaveToPage(bind, {
        focused,
        typing: isTypingTarget(document.activeElement),
        ownShortcut: ownShortcut(bind),
      })
    )
      return;
    if (action === "talk") {
      if (state.voice.inputMode === "ptt") talkGate.down("desktop");
    } else if (action === "mute") voice.setPushToMute(true);
    else if (action === "toggleMute") void voice.toggleMute();
    else void voice.toggleDeafen();
  });

  createEffect(() => {
    const testing = voice.gameKeyTest();
    // tracked: the person's shortcuts decide what the page handles itself
    state.keybinds.table();
    const wanted = state.voice.gameKeys && (inCall() || testing);
    const next = wanted
      ? activeBinds({
          // the test shows the push-to-talk key in either mode
          inputMode: testing ? "ptt" : state.voice.inputMode,
          pttKey: state.voice.pttKey,
          binds: cleanStoredBinds(state.voice.gameBinds),
        })
      : {};
    binds = next;
    if (!Object.keys(next).length) {
      if (listening) bridge.clear();
      listening = false;
      // nothing is held once nobody listens
      untrack(() => {
        talkGate.up("desktop");
        voice.setPushToMute(false);
      });
      return;
    }
    listening = true;
    void bridge
      .set(next)
      .then((status) => status && voice.setGameKeys(status))
      .catch(() => undefined);
  });

  // a bound mouse side button pressed inside the Zrzur window would also
  // go back or forward in the app: while it is a bind in use, it is not
  const onSideButton = (event: MouseEvent) => {
    const code = { 1: "Mouse3", 3: "Mouse4", 4: "Mouse5" }[event.button];
    if (code && Object.values(binds).some((bind) => bind?.code === code))
      event.preventDefault();
  };
  window.addEventListener("mouseup", onSideButton, true);
  window.addEventListener("auxclick", onSideButton, true);

  onCleanup(() => {
    window.removeEventListener("mouseup", onSideButton, true);
    window.removeEventListener("auxclick", onSideButton, true);
    stopStatus();
    stopEvents();
    if (listening) bridge.clear();
    talkGate.up("desktop");
  });
}
