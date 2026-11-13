import { describe, expect, it } from "vitest";

import {
  type PickerSource,
  firstChoice,
  moveChoice,
  sourceKind,
  sourcesOf,
} from "./screenSharePickerList";

const screen = (idx: number): PickerSource => ({
  idx,
  kind: "screen",
  name: "Gesamter Bildschirm",
  isFullScreen: true,
});
const win = (idx: number, name = `Window ${idx}`): PickerSource => ({
  idx,
  kind: "window",
  name,
  isFullScreen: false,
});

describe("screen share picker list", () => {
  it("puts screens and windows in their own tabs, in the system's order", () => {
    const all = [screen(0), win(1), screen(2), win(3)];
    expect(sourcesOf(all, "screen").map((s) => s.idx)).toEqual([0, 2]);
    expect(sourcesOf(all, "window").map((s) => s.idx)).toEqual([1, 3]);
  });

  it("reads an older desktop app's list by isFullScreen", () => {
    expect(sourceKind({ idx: 0, name: "a", isFullScreen: true })).toBe(
      "screen",
    );
    expect(sourceKind({ idx: 1, name: "b", isFullScreen: false })).toBe(
      "window",
    );
  });

  it("chooses the first screen, else the first window, else nothing", () => {
    expect(firstChoice([win(0), screen(1), screen(2)])).toBe(1);
    expect(firstChoice([win(4), win(5)])).toBe(4);
    expect(firstChoice([])).toBe(-1);
  });

  it("moves with the arrow keys through a grid, and stops at the edges", () => {
    const shown = [win(10), win(11), win(12), win(13), win(14)];
    expect(moveChoice(shown, 10, "ArrowRight", 3, false)).toBe(11);
    expect(moveChoice(shown, 10, "ArrowLeft", 3, false)).toBeUndefined();
    expect(moveChoice(shown, 10, "ArrowDown", 3, false)).toBe(13);
    expect(moveChoice(shown, 13, "ArrowUp", 3, false)).toBe(10);
    expect(moveChoice(shown, 12, "ArrowDown", 3, false)).toBeUndefined();
    expect(moveChoice(shown, 12, "Home", 3, false)).toBe(10);
    expect(moveChoice(shown, 12, "End", 3, false)).toBe(14);
    expect(moveChoice(shown, 12, "KeyA", 3, false)).toBeUndefined();
    expect(moveChoice([], 0, "ArrowRight", 3, false)).toBeUndefined();
  });

  it("mirrors left and right in Arabic", () => {
    const shown = [win(10), win(11), win(12)];
    expect(moveChoice(shown, 10, "ArrowLeft", 3, true)).toBe(11);
    expect(moveChoice(shown, 11, "ArrowRight", 3, true)).toBe(10);
  });
});
