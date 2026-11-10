import { describe, expect, it } from "vitest";

import { RESERVED_KEYS } from "../../../../../../../plugin-sdk/src/manifest";

import {
  CREATE_POLL_PLUGIN_KEYS,
  composerForShortcut,
  forgetComposer,
  isCreatePollShortcut,
  noteComposer,
  noteComposerFocus,
} from "./pollShortcut";

const key = (extra: Partial<KeyboardEvent>) =>
  ({
    code: "Digit7",
    altKey: false,
    shiftKey: true,
    ctrlKey: true,
    metaKey: false,
    ...extra,
  }) as KeyboardEvent;

describe("isCreatePollShortcut", () => {
  it("is Ctrl+Shift+7 by key position (Command on a Mac)", () => {
    expect(isCreatePollShortcut(key({}), false)).toBe(true);
    expect(
      isCreatePollShortcut(key({ ctrlKey: false, metaKey: true }), true),
    ).toBe(true);
  });

  it("is never Alt+Shift (Windows switches the keyboard layout with it)", () => {
    expect(
      isCreatePollShortcut(key({ ctrlKey: false, altKey: true }), false),
    ).toBe(false);
    expect(
      isCreatePollShortcut(
        key({ ctrlKey: false, altKey: true, code: "KeyP" }),
        false,
      ),
    ).toBe(false);
  });

  it("is not AltGr (Ctrl+Alt) and nothing else", () => {
    expect(isCreatePollShortcut(key({ altKey: true }), false)).toBe(false);
    expect(isCreatePollShortcut(key({ shiftKey: false }), false)).toBe(false);
    expect(isCreatePollShortcut(key({ code: "Digit8" }), false)).toBe(false);
    expect(isCreatePollShortcut(key({ metaKey: true }), false)).toBe(false);
  });

  it("is reserved, so no plugin can take it", () => {
    for (const keys of CREATE_POLL_PLUGIN_KEYS)
      expect(RESERVED_KEYS).toContain(keys);
  });
});

describe("composerForShortcut", () => {
  it("is the message box focused last, or the first one shown", () => {
    noteComposer("channel");
    noteComposer("thread");
    expect(composerForShortcut()).toBe("channel");
    noteComposerFocus("thread");
    expect(composerForShortcut()).toBe("thread");
    forgetComposer("thread");
    expect(composerForShortcut()).toBe("channel");
    forgetComposer("channel");
    expect(composerForShortcut()).toBeUndefined();
  });
});
