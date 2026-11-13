import { describe, expect, it } from "vitest";

import {
  activeBinds,
  bindCaps,
  checkBind,
  cleanReleaseDelay,
  cleanStoredBinds,
  desktopGameKeys,
  formatBind,
  gameKeysUsable,
  leaveToPage,
  parseBind,
  plainKey,
  readBindKey,
  readBindKeyUp,
  readBindMouse,
} from "./gameKeys";
import { createTalkGate } from "./talkGate";

const NONE = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };

describe("bind text", () => {
  it("reads keys, combinations, modifiers alone and mouse buttons", () => {
    expect(parseBind("KeyV")).toEqual({ code: "KeyV" });
    expect(parseBind("Ctrl+Shift+KeyV")).toEqual({
      code: "KeyV",
      ctrl: true,
      shift: true,
    });
    expect(parseBind("Mouse4")).toEqual({ code: "Mouse4" });
    expect(parseBind("Alt+Mouse5")).toEqual({ code: "Mouse5", alt: true });
    expect(parseBind("ControlRight")).toEqual({ code: "ControlRight" });
    // a modifier never needs itself held as well
    expect(parseBind("Ctrl+ControlLeft")).toEqual({ code: "ControlLeft" });
    expect(parseBind("Ctrl+ShiftLeft")).toEqual({
      code: "ShiftLeft",
      ctrl: true,
    });
  });

  it("refuses anything that is not a bind", () => {
    for (const text of [
      "",
      "Mouse1",
      "Mouse2",
      "Nope",
      "Ctrl+",
      "Ctrl+Ctrl+KeyV",
      "Hyper+KeyV",
      "ctrl+KeyV",
      "KeyV+Ctrl",
      "K".repeat(80),
      5,
      undefined,
      null,
      {},
    ])
      expect(parseBind(text), String(text)).toBeUndefined();
  });

  it("writes a bind the same way every time", () => {
    expect(formatBind({ code: "KeyV", shift: true, ctrl: true })).toBe(
      "Ctrl+Shift+KeyV",
    );
    expect(
      formatBind({
        code: "F9",
        meta: true,
        alt: true,
        shift: true,
        ctrl: true,
      }),
    ).toBe("Ctrl+Alt+Shift+Meta+F9");
    for (const text of ["Mouse4", "Ctrl+Alt+F9", "AltRight", "Shift+Space"])
      expect(formatBind(parseBind(text)!)).toBe(text);
  });

  it("names the key caps", () => {
    const label = (code: string) => code.replace(/^Key/, "");
    expect(bindCaps({ code: "KeyV", ctrl: true }, label)).toEqual([
      "Ctrl",
      "V",
    ]);
    expect(bindCaps({ code: "Mouse4" }, label)).toEqual(["Mouse 4"]);
    expect(bindCaps({ code: "ControlRight" }, label)).toEqual(["Right Ctrl"]);
    expect(bindCaps({ code: "ShiftLeft", alt: true }, label)).toEqual([
      "Alt",
      "Shift",
    ]);
  });
});

describe("which binds are allowed", () => {
  it("a held key can be any key but Esc, Tab, Enter and Backspace", () => {
    expect(checkBind("talk", { code: "KeyV" }, {})).toBeUndefined();
    expect(checkBind("talk", { code: "Mouse4" }, {})).toBeUndefined();
    expect(checkBind("mute", { code: "AltRight" }, {})).toBeUndefined();
    for (const code of ["Escape", "Tab", "Enter", "Backspace", "Nope"])
      expect(checkBind("talk", { code }, {}), code).toBe("reserved");
  });

  it("a switch is never a key that types on its own", () => {
    expect(checkBind("toggleMute", { code: "KeyM" }, {})).toBe("typing");
    expect(checkBind("toggleDeafen", { code: "Space" }, {})).toBe("typing");
    expect(
      checkBind("toggleMute", { code: "KeyM", ctrl: true, shift: true }, {}),
    ).toBeUndefined();
    expect(checkBind("toggleMute", { code: "F9" }, {})).toBeUndefined();
    expect(checkBind("toggleMute", { code: "Mouse5" }, {})).toBeUndefined();
    expect(checkBind("toggleDeafen", { code: "Numpad0" }, {})).toBeUndefined();
  });

  it("two actions never share a bind", () => {
    expect(
      checkBind("mute", { code: "Mouse4" }, { talk: { code: "Mouse4" } }),
    ).toEqual({ clash: "talk" });
    expect(
      checkBind("talk", { code: "Mouse4" }, { talk: { code: "Mouse4" } }),
    ).toBeUndefined();
  });

  it("stored binds are checked again when read", () => {
    expect(
      cleanStoredBinds({
        talk: "Mouse4",
        mute: "Mouse4",
        toggleMute: "KeyM",
        toggleDeafen: "Ctrl+Shift+F10",
        other: "KeyA",
      }),
    ).toEqual({ talk: "Mouse4", toggleDeafen: "Ctrl+Shift+F10" });
    expect(cleanStoredBinds(undefined)).toEqual({});
    expect(cleanStoredBinds("x")).toEqual({});
  });

  it("release delay stays between 0 and 2 seconds", () => {
    expect(cleanReleaseDelay(300)).toBe(300);
    expect(cleanReleaseDelay(0)).toBe(0);
    for (const value of [-1, 2001, "300", NaN, undefined])
      expect(cleanReleaseDelay(value)).toBe(200);
  });
});

describe("recording a bind", () => {
  it("reads a key with the modifiers held", () => {
    expect(readBindKey({ ...NONE, code: "KeyV" })).toEqual({ code: "KeyV" });
    expect(readBindKey({ ...NONE, code: "KeyV", ctrlKey: true })).toEqual({
      code: "KeyV",
      ctrl: true,
    });
  });

  it("waits on a modifier, cancels on Esc", () => {
    expect(readBindKey({ ...NONE, code: "ControlLeft", ctrlKey: true })).toBe(
      "wait",
    );
    expect(readBindKey({ ...NONE, code: "Escape" })).toBe("cancel");
    expect(readBindKey({ ...NONE, code: "IntlRo" })).toBe("wait");
  });

  it("a modifier let go alone is the bind", () => {
    expect(readBindKeyUp({ ...NONE, code: "ControlRight" })).toEqual({
      code: "ControlRight",
    });
    expect(
      readBindKeyUp({ ...NONE, code: "ShiftLeft", ctrlKey: true }),
    ).toEqual({ code: "ShiftLeft", ctrl: true });
    expect(readBindKeyUp({ ...NONE, code: "KeyV" })).toBeUndefined();
  });

  it("reads the middle and side mouse buttons only", () => {
    expect(readBindMouse({ ...NONE, button: 1 })).toEqual({ code: "Mouse3" });
    expect(readBindMouse({ ...NONE, button: 3 })).toEqual({ code: "Mouse4" });
    expect(readBindMouse({ ...NONE, button: 4, altKey: true })).toEqual({
      code: "Mouse5",
      alt: true,
    });
    expect(readBindMouse({ ...NONE, button: 0 })).toBeUndefined();
    expect(readBindMouse({ ...NONE, button: 2 })).toBeUndefined();
  });
});

describe("what the desktop app listens for", () => {
  it("push to talk uses the push-to-talk key unless a game bind is set", () => {
    expect(
      activeBinds({ inputMode: "ptt", pttKey: "Backquote", binds: {} }),
    ).toEqual({ talk: { code: "Backquote" } });
    expect(
      activeBinds({
        inputMode: "ptt",
        pttKey: "Backquote",
        binds: { talk: "Mouse4" },
      }),
    ).toEqual({ talk: { code: "Mouse4" } });
  });

  it("with voice activity and no binds, nothing is listened for", () => {
    expect(
      activeBinds({ inputMode: "voice", pttKey: "Backquote", binds: {} }),
    ).toEqual({});
    expect(
      activeBinds({
        inputMode: "voice",
        pttKey: "Backquote",
        binds: { talk: "Mouse4", toggleMute: "F9" },
      }),
    ).toEqual({ toggleMute: { code: "F9" } });
  });

  it("the push-to-talk key is left out when another action has it", () => {
    expect(
      activeBinds({
        inputMode: "ptt",
        pttKey: "F9",
        binds: { toggleMute: "F9" },
      }),
    ).toEqual({ toggleMute: { code: "F9" } });
  });
});

describe("a key heard while the Zrzur window is in front", () => {
  const page = { focused: true, typing: false, ownShortcut: false };
  it("is used from any other window", () => {
    expect(
      leaveToPage(
        { code: "KeyV" },
        { focused: false, typing: true, ownShortcut: true },
      ),
    ).toBe(false);
  });
  it("is left alone while typing with a plain key", () => {
    expect(leaveToPage({ code: "KeyV" }, { ...page, typing: true })).toBe(true);
    expect(leaveToPage({ code: "KeyV" }, page)).toBe(false);
    // mouse buttons, modifiers and combinations type nothing
    expect(leaveToPage({ code: "Mouse4" }, { ...page, typing: true })).toBe(
      false,
    );
    expect(
      leaveToPage({ code: "ControlRight" }, { ...page, typing: true }),
    ).toBe(false);
    expect(plainKey({ code: "KeyV", ctrl: true })).toBe(false);
  });
  it("is left to the page when its own shortcut is on the same keys", () => {
    expect(
      leaveToPage(
        { code: "KeyM", ctrl: true, shift: true },
        { ...page, ownShortcut: true },
      ),
    ).toBe(true);
  });
});

describe("talk gate", () => {
  function gate(delay: number) {
    const applied: boolean[] = [];
    const timers: { callback: () => void; ms: number }[] = [];
    const g = createTalkGate(
      (open) => applied.push(open),
      () => delay,
      {
        set: (callback, ms) => {
          const timer = { callback, ms };
          timers.push(timer);
          return timer;
        },
        clear: (handle) => {
          const index = timers.indexOf(handle as (typeof timers)[number]);
          if (index >= 0) timers.splice(index, 1);
        },
      },
    );
    const run = () => timers.splice(0).forEach((timer) => timer.callback());
    return { g, applied, timers, run };
  }

  it("opens on the key down and closes on the key up", () => {
    const { g, applied } = gate(0);
    g.down("key");
    g.down("key");
    expect(g.open).toBe(true);
    g.up("key");
    expect(applied).toEqual([true, false]);
    // an up without a down changes nothing
    g.up("key");
    expect(applied).toEqual([true, false]);
  });

  it("stays open for the release delay, then closes", () => {
    const { g, applied, timers, run } = gate(300);
    g.down("key");
    g.up("key");
    expect(applied).toEqual([true]);
    expect(timers.map((timer) => timer.ms)).toEqual([300]);
    run();
    expect(applied).toEqual([true, false]);
  });

  it("a new press inside the delay keeps it open, with no gap", () => {
    const { g, applied, timers, run } = gate(300);
    g.down("key");
    g.up("key");
    g.down("key");
    expect(timers).toEqual([]);
    run();
    expect(applied).toEqual([true]);
    g.up("key");
    run();
    expect(applied).toEqual([true, false]);
  });

  it("stays open until the last holder lets go", () => {
    const { g, applied } = gate(0);
    g.down("window");
    g.down("desktop");
    g.up("window");
    expect(applied).toEqual([true]);
    g.up("desktop");
    expect(applied).toEqual([true, false]);
  });

  it("reset closes at once and forgets every holder", () => {
    const { g, applied, timers } = gate(300);
    g.down("window");
    g.down("desktop");
    g.reset();
    expect(applied).toEqual([true, false]);
    g.up("desktop");
    expect(timers).toEqual([]);
    // and while the delay is running
    g.down("window");
    g.up("window");
    g.reset();
    expect(timers).toEqual([]);
    expect(applied).toEqual([true, false, true, false]);
  });
});

describe("desktop bridge", () => {
  it("is used only when complete", () => {
    const win = globalThis as unknown as { window?: { native?: unknown } };
    const had = win.window;
    win.window = { native: undefined };
    expect(desktopGameKeys()).toBeUndefined();
    win.window.native = { globalKeys: { status() {}, set() {} } };
    expect(desktopGameKeys()).toBeUndefined();
    const full = {
      status() {},
      set() {},
      clear() {},
      askPermission() {},
      onEvent() {},
      onStatus() {},
    };
    win.window.native = { globalKeys: full };
    expect(desktopGameKeys()).toBe(full);
    win.window = had;
  });

  it("knows when keys can be heard", () => {
    const base = { platform: "win32", wayland: false };
    expect(gameKeysUsable({ ...base, state: "on" })).toBe(true);
    expect(gameKeysUsable({ ...base, state: "ready" })).toBe(true);
    expect(gameKeysUsable({ ...base, state: "permission" })).toBe(false);
    expect(gameKeysUsable({ ...base, state: "error" })).toBe(false);
    expect(gameKeysUsable(undefined)).toBe(false);
  });
});
