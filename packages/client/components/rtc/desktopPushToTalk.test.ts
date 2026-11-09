import { afterEach, describe, expect, it, vi } from "vitest";

import { desktopPushToTalk, globalPttCombo } from "./desktopPushToTalk";

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
