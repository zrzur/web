import { describe, expect, it } from "vitest";

import { takesEscape } from "./takesEscape";

describe("what Esc closes in the floating layer", () => {
  it("a menu or a card", () => {
    expect(takesEscape({ userCard: {} })).toBe(true);
    expect(takesEscape({ contextMenu: () => null })).toBe(true);
    expect(takesEscape({ autoComplete: {} })).toBe(true);
  });

  it("a tooltip opened by a press (it stays until dismissed)", () => {
    expect(takesEscape({ tooltip: { content: "x", press: true } })).toBe(true);
  });

  it("not a tooltip that only follows the pointer: Esc keeps its own job", () => {
    // it closes when the pointer leaves, and Esc cannot close it while the
    // pointer rests there, so taking the key would swallow every press
    expect(takesEscape({ tooltip: { content: "Sent 12/11/2026" } })).toBe(
      false,
    );
  });

  it("a card with a tooltip is still a card", () => {
    expect(takesEscape({ tooltip: { content: "x" }, userCard: {} })).toBe(true);
  });

  it("nothing open", () => {
    expect(takesEscape(undefined)).toBe(false);
  });
});
