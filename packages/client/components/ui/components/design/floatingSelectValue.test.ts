import { describe, expect, it } from "vitest";

import { readItemValue } from "./floatingSelectValue";

/** a menu item as the select reads it */
const item = (attrs: Record<string, string>) =>
  ({
    getAttribute: (name: string) => attrs[name] ?? null,
    hasAttribute: (name: string) => name in attrs,
  }) as unknown as HTMLElement;

describe("FloatingSelect item values", () => {
  it("reads an empty value as a real choice", () => {
    // "First channel everyone can read" is value="" and showed as "—"
    expect(readItemValue(item({ value: "" }))).toBe("");
  });

  it("reads value, then data-value", () => {
    expect(readItemValue(item({ value: "a" }))).toBe("a");
    expect(readItemValue(item({ "data-value": "b" }))).toBe("b");
  });

  it("has no value when neither attribute is set", () => {
    expect(readItemValue(item({}))).toBeUndefined();
  });

  it("skips a child that is not an element (an empty <Show>)", () => {
    // "Set your status" never opened: the select read `undefined` as an item
    expect(readItemValue(undefined)).toBeUndefined();
    expect(readItemValue("text" as unknown as HTMLElement)).toBeUndefined();
  });
});
