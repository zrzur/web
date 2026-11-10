// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  comboLabel,
  isTypingTarget,
  keyLabel,
  matchGlobalShortcut,
  pttKeyAllowed,
  readPttKey,
  transmitting,
} from "./shortcuts";

const key = (code: string, mods: Partial<KeyboardEvent> = {}) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("matchGlobalShortcut", () => {
  it("finds mute, deafen and the shortcuts list with Ctrl", () => {
    expect(
      matchGlobalShortcut(
        key("KeyM", { ctrlKey: true, shiftKey: true }),
        false,
      ),
    ).toBe("toggle_mute");
    expect(
      matchGlobalShortcut(
        key("KeyD", { ctrlKey: true, shiftKey: true }),
        false,
      ),
    ).toBe("toggle_deafen");
    expect(matchGlobalShortcut(key("Slash", { ctrlKey: true }), false)).toBe(
      "open_shortcuts",
    );
  });

  it("uses Command instead of Ctrl on a Mac", () => {
    expect(
      matchGlobalShortcut(key("KeyM", { metaKey: true, shiftKey: true }), true),
    ).toBe("toggle_mute");
    expect(
      matchGlobalShortcut(key("KeyM", { ctrlKey: true, shiftKey: true }), true),
    ).toBeUndefined();
  });

  it("needs the exact modifiers", () => {
    expect(matchGlobalShortcut(key("KeyM", { ctrlKey: true }), false)).toBe(
      undefined,
    );
    expect(
      matchGlobalShortcut(
        key("KeyM", { ctrlKey: true, shiftKey: true, altKey: true }),
        false,
      ),
    ).toBeUndefined();
    expect(
      matchGlobalShortcut(
        key("Slash", { ctrlKey: true, shiftKey: true }),
        false,
      ),
    ).toBeUndefined();
    expect(matchGlobalShortcut(key("KeyM"), false)).toBeUndefined();
  });

  it("matches the physical key, so Arabic and German layouts work", () => {
    // on an Arabic layout KeyM types "ة", the code stays KeyM
    expect(
      matchGlobalShortcut(
        key("KeyM", { ctrlKey: true, shiftKey: true, key: "ة" }),
        false,
      ),
    ).toBe("toggle_mute");
  });
});

describe("Ctrl+/ on layouts where / is Shift+7", () => {
  it("opens the shortcuts screen on a German keyboard", () => {
    expect(
      matchGlobalShortcut(
        { ...key("Digit7", { ctrlKey: true, shiftKey: true }), key: "/" },
        false,
      ),
    ).toBe("open_shortcuts");
    expect(
      matchGlobalShortcut(
        { ...key("Digit7", { metaKey: true, shiftKey: true }), key: "/" },
        true,
      ),
    ).toBe("open_shortcuts");
  });

  it("still opens it on a US keyboard", () => {
    expect(
      matchGlobalShortcut(
        { ...key("Slash", { ctrlKey: true }), key: "/" },
        false,
      ),
    ).toBe("open_shortcuts");
  });
});

describe("isTypingTarget", () => {
  it("is true for text fields and editors", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    editor.appendChild(inner);
    document.body.appendChild(editor);
    expect(isTypingTarget(inner)).toBe(true);
    editor.remove();
  });

  it("is false for buttons, the page and nothing", () => {
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("treats checkboxes and range inputs as not typing", () => {
    const box = document.createElement("input");
    box.type = "checkbox";
    expect(isTypingTarget(box)).toBe(false);
    const range = document.createElement("input");
    range.type = "range";
    expect(isTypingTarget(range)).toBe(false);
  });
});

describe("transmitting", () => {
  it("always sends in voice activity mode", () => {
    expect(transmitting("voice", false)).toBe(true);
  });
  it("sends only while the key is held in push to talk", () => {
    expect(transmitting("ptt", false)).toBe(false);
    expect(transmitting("ptt", true)).toBe(true);
  });
});

describe("pttKeyAllowed", () => {
  it("accepts ordinary keys", () => {
    for (const code of ["Backquote", "KeyV", "F13", "CapsLock", "Space"])
      expect(pttKeyAllowed(code)).toBe(true);
  });
  it("refuses keys needed to use the app", () => {
    for (const code of [
      "",
      "Escape",
      "Tab",
      "Enter",
      "NumpadEnter",
      "Backspace",
      "ControlLeft",
      "MetaRight",
      "ShiftLeft",
      "AltLeft",
    ])
      expect(pttKeyAllowed(code)).toBe(false);
  });
});

describe("readPttKey", () => {
  it("takes the pressed key", () => {
    expect(readPttKey(key("KeyV"))).toEqual({ code: "KeyV" });
  });
  it("cancels on Escape", () => {
    expect(readPttKey(key("Escape"))).toBe("cancel");
  });
  it("refuses keys that are not allowed", () => {
    expect(readPttKey(key("Enter"))).toBe("blocked");
  });
  it("ignores a lone modifier press and waits for a real key", () => {
    expect(readPttKey(key("ShiftLeft"))).toBe("wait");
  });
});

describe("labels", () => {
  it("names keys the way they are printed", () => {
    expect(keyLabel("KeyV")).toBe("V");
    expect(keyLabel("Digit3")).toBe("3");
    expect(keyLabel("Backquote")).toBe("`");
    expect(keyLabel("F13")).toBe("F13");
    expect(keyLabel("Numpad5")).toBe("Num 5");
    expect(keyLabel("CapsLock")).toBe("Caps Lock");
    expect(keyLabel("ArrowUp")).toBe("↑");
  });

  it("writes combos per platform", () => {
    expect(comboLabel(["Mod", "Shift", "M"], false)).toEqual([
      "Ctrl",
      "Shift",
      "M",
    ]);
    expect(comboLabel(["Mod", "Shift", "M"], true)).toEqual(["⌘", "⇧", "M"]);
    expect(comboLabel(["Alt", "↑"], true)).toEqual(["⌥", "↑"]);
  });
});

describe("app shortcuts and text fields (review B2)", () => {
  it("a shortcut without Ctrl or Alt leaves a text field alone", async () => {
    const { bindKeymap, unbindKeymap, shortcutFor } = await import("./active");
    const { compileKeymap } = await import("./keymap");
    bindKeymap((mac) =>
      compileKeymap({ toggle_streamer: { code: "F8" } }, mac),
    );
    const field = document.createElement("input");
    const button = document.createElement("button");
    const f8 = { ...key("F8"), key: "F8" };
    expect(shortcutFor({ ...f8, target: field }, false)).toBe(undefined);
    expect(shortcutFor({ ...f8, target: button }, false)).toBe(
      "toggle_streamer",
    );
    // with a modifier it still works while typing
    expect(
      shortcutFor(
        { ...key("KeyM", { ctrlKey: true, shiftKey: true }), target: field },
        false,
      ),
    ).toBe("toggle_mute");
    unbindKeymap();
  });
});

describe("push-to-talk key and bare shortcut keys (review S6)", () => {
  it("refuses a key that is a shortcut on its own", async () => {
    const { bindKeymap, unbindKeymap } = await import("./active");
    const { compileKeymap } = await import("./keymap");
    bindKeymap((mac) =>
      compileKeymap({ toggle_streamer: { code: "F8" } }, mac),
    );
    expect(readPttKey(key("F8"))).toBe("blocked");
    expect(readPttKey(key("F9"))).toEqual({ code: "F9" });
    unbindKeymap();
  });
});
