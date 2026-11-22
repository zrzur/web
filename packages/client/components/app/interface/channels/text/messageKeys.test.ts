import { describe, expect, it } from "vitest";

import { messageAriaKeys, messageKeyAction } from "./messageKeys";

const key = (
  code: string,
  mods: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
  > & { isComposing?: boolean } = {},
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

  it("never acts while a character is being composed", () => {
    expect(messageKeyAction(key("KeyR", { isComposing: true }), false)).toBe(
      undefined,
    );
  });

  it("names the keys for screen readers", () => {
    expect(messageAriaKeys(false)).toContain("Control+C");
    expect(messageAriaKeys(true)).toContain("Meta+C");
    expect(messageAriaKeys(false)).toContain("Shift+Delete");
  });
});
