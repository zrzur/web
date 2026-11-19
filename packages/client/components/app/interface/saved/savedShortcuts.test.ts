import { describe, expect, it } from "vitest";

import { RESERVED_KEYS } from "../../../../../plugin-sdk/src/manifest";
import {
  DEFAULTS,
  REMAPPABLE,
  defaultTable,
  matchShortcut,
} from "../../../keybinds/keymap";
import { matchGlobalShortcut } from "../../../keybinds/shortcuts";

const press = (code: string, extra: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    key: "",
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    ...extra,
  }) as KeyboardEvent;

describe("shortcuts for saved messages and reminders", () => {
  it("Ctrl+Shift+4 opens saved messages, Ctrl+Shift+5 the reminders", () => {
    const map = defaultTable(false);
    expect(matchShortcut(map, press("Digit4"), false)).toBe("view_saved");
    expect(matchShortcut(map, press("Digit5"), false)).toBe("view_reminders");
  });

  it("on a Mac they stay off the screenshot keys", () => {
    const map = defaultTable(true);
    const mac = { ctrlKey: true, metaKey: true, shiftKey: false };
    expect(matchShortcut(map, press("KeyB", mac), true)).toBe("view_saved");
    expect(matchShortcut(map, press("KeyR", mac), true)).toBe("view_reminders");
    const screenshot = { ctrlKey: false, metaKey: true, shiftKey: true };
    expect(matchShortcut(map, press("Digit4", screenshot), true)).toBe(
      undefined,
    );
    expect(matchShortcut(map, press("Digit5", screenshot), true)).toBe(
      undefined,
    );
  });

  it("share their keys with no other shortcut", () => {
    for (const mac of [false, true]) {
      const table = defaultTable(mac);
      expect(table.byCombo.size).toBe(REMAPPABLE.length);
    }
    expect(Object.keys(DEFAULTS)).toContain("view_saved");
    expect(Object.keys(DEFAULTS)).toContain("view_reminders");
  });

  it("are listed, changeable, and not app-wide voice shortcuts", () => {
    expect(REMAPPABLE).toContain("view_saved");
    expect(REMAPPABLE).toContain("view_reminders");
    expect(matchGlobalShortcut(press("Digit4"), false)).toBe(undefined);
    expect(matchGlobalShortcut(press("Digit5"), false)).toBe(undefined);
  });

  it("are not the key that types / on German and Nordic layouts", () => {
    // Ctrl+Shift+7 there is Ctrl+/ (the shortcuts list)
    const map = defaultTable(false);
    expect(matchShortcut(map, press("Digit7", { key: "/" }), false)).toBe(
      "open_shortcuts",
    );
  });

  it("are reserved, so no plugin can take them", () => {
    expect(RESERVED_KEYS).toContain("Ctrl+Shift+4");
    expect(RESERVED_KEYS).toContain("Ctrl+Shift+5");
  });
});
