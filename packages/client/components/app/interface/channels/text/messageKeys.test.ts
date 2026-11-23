import { describe, expect, it } from "vitest";

import { messageAriaKeys, messageKeyAction } from "./messageKeys";

const ALL = { reply: true, edit: true, remove: true, pin: true, copy: true };
const NONE = {
  reply: false,
  edit: false,
  remove: false,
  pin: false,
  copy: false,
};

const key = (
  code: string,
  mods: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
  > & { isComposing?: boolean; keyCode?: number } = {},
) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("messageKeyAction", () => {
  it("reads the single keys by their place on the keyboard", () => {
    expect(messageKeyAction(key("KeyR"), false)).toBe("reply");
    expect(messageKeyAction(key("KeyE"), false)).toBe("edit");
    expect(messageKeyAction(key("KeyP"), false)).toBe("pin");
    expect(messageKeyAction(key("Delete"), false)).toBe("delete");
    expect(messageKeyAction(key("Delete", { shiftKey: true }), false)).toBe(
      "delete_now",
    );
  });

  it("copies with Ctrl+C, Command+C on a Mac", () => {
    expect(messageKeyAction(key("KeyC", { ctrlKey: true }), false)).toBe(
      "copy",
    );
    expect(messageKeyAction(key("KeyC", { metaKey: true }), true)).toBe("copy");
    expect(messageKeyAction(key("KeyC", { ctrlKey: true }), true)).toBe(
      undefined,
    );
    expect(
      messageKeyAction(key("KeyC", { ctrlKey: true, shiftKey: true }), false),
    ).toBe(undefined);
  });

  it("leaves keys with other modifiers alone", () => {
    expect(messageKeyAction(key("KeyR", { ctrlKey: true }), false)).toBe(
      undefined,
    );
    expect(messageKeyAction(key("KeyR", { shiftKey: true }), false)).toBe(
      undefined,
    );
    expect(messageKeyAction(key("KeyR", { altKey: true }), false)).toBe(
      undefined,
    );
    expect(messageKeyAction(key("KeyR", { metaKey: true }), false)).toBe(
      undefined,
    );
    expect(messageKeyAction(key("Delete", { ctrlKey: true }), false)).toBe(
      undefined,
    );
    expect(messageKeyAction(key("KeyQ"), false)).toBe(undefined);
  });

  it("never acts while a character is being composed (also key code 229)", () => {
    expect(messageKeyAction(key("KeyR", { isComposing: true }), false)).toBe(
      undefined,
    );
    expect(messageKeyAction(key("Enter", { keyCode: 229 }), false)).toBe(
      undefined,
    );
    expect(messageKeyAction(key("KeyR", { keyCode: 229 }), false)).toBe(
      undefined,
    );
  });

  it("takes Backspace for Delete on a Mac only", () => {
    expect(messageKeyAction(key("Backspace"), true)).toBe("delete");
    expect(messageKeyAction(key("Backspace", { shiftKey: true }), true)).toBe(
      "delete_now",
    );
    expect(messageKeyAction(key("Backspace"), false)).toBe(undefined);
  });

  it("names only the keys a message takes, for screen readers", () => {
    expect(messageAriaKeys(false, ALL)).toBe(
      "R E P Delete Shift+Delete Control+C",
    );
    expect(messageAriaKeys(true, ALL)).toContain("Backspace Shift+Backspace");
    expect(messageAriaKeys(true, ALL)).toContain("Meta+C");
    // someone else's message in a channel you can only read
    expect(messageAriaKeys(false, { ...NONE, copy: true })).toBe("Control+C");
    expect(messageAriaKeys(false, NONE)).toBe("");
  });
});
