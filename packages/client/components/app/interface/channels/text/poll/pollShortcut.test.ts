import { describe, expect, it } from "vitest";

import { claimCreatePollShortcut, isCreatePollShortcut } from "./pollShortcut";

const key = (extra: Partial<KeyboardEvent>) =>
  ({
    code: "KeyP",
    altKey: true,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    ...extra,
  }) as KeyboardEvent;

describe("isCreatePollShortcut", () => {
  it("is Alt+Shift+P by key position", () => {
    expect(isCreatePollShortcut(key({}))).toBe(true);
  });

  it("is nothing else", () => {
    expect(isCreatePollShortcut(key({ shiftKey: false }))).toBe(false);
    expect(isCreatePollShortcut(key({ ctrlKey: true }))).toBe(false);
    expect(isCreatePollShortcut(key({ metaKey: true }))).toBe(false);
    expect(isCreatePollShortcut(key({ code: "KeyO" }))).toBe(false);
  });
});

describe("claimCreatePollShortcut", () => {
  it("lets only the first message box answer one press", () => {
    expect(claimCreatePollShortcut(10_000)).toBe(true);
    expect(claimCreatePollShortcut(10_050)).toBe(false);
    expect(claimCreatePollShortcut(11_000)).toBe(true);
  });
});
