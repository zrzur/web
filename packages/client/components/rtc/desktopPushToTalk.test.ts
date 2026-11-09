import { afterEach, describe, expect, it, vi } from "vitest";

import {
  desktopPushToTalk,
  globalPttCombo,
  globalTalkAllowed,
  latchPress,
} from "./desktopPushToTalk";

const win = globalThis as unknown as { window?: { native?: unknown } };

afterEach(() => {
  delete win.window;
});

describe("desktop push-to-talk bridge", () => {
  it("is absent in a browser", () => {
    expect(desktopPushToTalk()).toBeUndefined();
    win.window = {};
    expect(desktopPushToTalk()).toBeUndefined();
    // an older desktop app without the bridge
    win.window = { native: { minimise() {} } };
    expect(desktopPushToTalk()).toBeUndefined();
  });

  it("is used only when the desktop app exposes all of it", () => {
    const bridge = {
      register: vi.fn(async () => true),
      unregister: vi.fn(),
      onToggle: vi.fn(() => () => undefined),
    };
    win.window = { native: { pushToTalk: bridge } };
    expect(desktopPushToTalk()).toBe(bridge);
    win.window = {
      native: { pushToTalk: { register: bridge.register } },
    };
    expect(desktopPushToTalk()).toBeUndefined();
  });
});

describe("global push-to-talk combination", () => {
  it("is Ctrl+Shift with the push-to-talk key, or ⌘⇧ on a Mac", () => {
    expect(globalPttCombo("Backquote", false)).toBe("Ctrl+Shift+`");
    expect(globalPttCombo("KeyV", false)).toBe("Ctrl+Shift+V");
    expect(globalPttCombo("KeyV", true)).toBe("⌘⇧V");
  });
});

describe("talk toggle presses", () => {
  it("turns talking on and off with the matching sound", () => {
    expect(latchPress(false, true)).toEqual({ latched: true, sound: "unmute" });
    expect(latchPress(true, true)).toEqual({ latched: false, sound: "mute" });
  });

  it("is ignored while muted or deafened, with the mute sound as the answer", () => {
    expect(latchPress(false, false)).toEqual({ latched: false, sound: "mute" });
    expect(latchPress(true, false)).toEqual({ latched: false, sound: "mute" });
  });
});

describe("keys that can talk from other apps", () => {
  it("refuses keys other apps use with Ctrl+Shift for editing and moving", () => {
    for (const code of [
      "KeyA",
      "KeyC",
      "KeyF",
      "KeyN",
      "KeyT",
      "KeyV",
      "KeyW",
      "KeyX",
      "KeyZ",
      "ArrowUp",
      "Space",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ])
      expect(globalTalkAllowed(code), code).toBe(false);
  });

  it("allows the default key, other letters, digits, F keys and the numpad", () => {
    for (const code of ["Backquote", "KeyB", "Digit4", "F13", "F24", "Numpad5"])
      expect(globalTalkAllowed(code), code).toBe(true);
  });
});
