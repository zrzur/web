import { describe, expect, it } from "vitest";

import { formatFor, toggleMark } from "./formatKeys";

const key = (
  code: string,
  mods: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
  > = {},
) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

/** Apply an edit to a text */
function apply(doc: string, from: number, to: number, mark: "**" | "*" | "__") {
  const edit = toggleMark(doc, from, to, mark);
  const next = doc.slice(0, edit.from) + edit.insert + doc.slice(edit.to);
  return { next, selected: next.slice(edit.anchor, edit.head) };
}

describe("formatFor", () => {
  it("is Ctrl+B and Ctrl+I, Command on a Mac, by key place", () => {
    expect(formatFor(key("KeyB", { ctrlKey: true }), false)).toBe("**");
    expect(formatFor(key("KeyI", { ctrlKey: true }), false)).toBe("*");
    expect(formatFor(key("KeyB", { metaKey: true }), true)).toBe("**");
    expect(formatFor(key("KeyB", { ctrlKey: true }), true)).toBe(undefined);
    expect(
      formatFor(key("KeyB", { ctrlKey: true, shiftKey: true }), false),
    ).toBe(undefined);
    expect(formatFor(key("KeyB"), false)).toBe(undefined);
  });

  it("is Ctrl+U for underline", () => {
    expect(formatFor(key("KeyU", { ctrlKey: true }), false)).toBe("__");
    expect(formatFor(key("KeyU", { metaKey: true }), true)).toBe("__");
  });
});

describe("toggleMark", () => {
  it("wraps the selection and keeps it selected", () => {
    expect(apply("say hi now", 4, 6, "**")).toEqual({
      next: "say **hi** now",
      selected: "hi",
    });
    expect(apply("مرحبا", 0, 5, "*")).toEqual({
      next: "*مرحبا*",
      selected: "مرحبا",
    });
  });

  it("takes the mark off again", () => {
    expect(apply("say **hi** now", 6, 8, "**")).toEqual({
      next: "say hi now",
      selected: "hi",
    });
    expect(apply("a *b* c", 3, 4, "*")).toEqual({
      next: "a b c",
      selected: "b",
    });
  });

  it("makes bold text italic instead of breaking the bold", () => {
    expect(apply("**hi**", 2, 4, "*").next).toBe("***hi***");
  });

  it("takes italic or bold off bold italic text, one mark at a time", () => {
    expect(apply("***hi***", 3, 5, "*")).toEqual({
      next: "**hi**",
      selected: "hi",
    });
    expect(apply("***hi***", 3, 5, "**")).toEqual({
      next: "*hi*",
      selected: "hi",
    });
    expect(apply("*hi*", 1, 3, "**").next).toBe("***hi***");
  });

  it("underlines with two underscores and takes them off again", () => {
    expect(apply("say hi now", 4, 6, "__")).toEqual({
      next: "say __hi__ now",
      selected: "hi",
    });
    expect(apply("say __hi__ now", 6, 8, "__")).toEqual({
      next: "say hi now",
      selected: "hi",
    });
    expect(apply("**hi**", 2, 4, "__").next).toBe("**__hi__**");
  });

  it("puts an empty pair at the cursor", () => {
    const edit = toggleMark("ab", 1, 1, "**");
    expect(edit.insert).toBe("****");
    expect(edit.anchor).toBe(3);
    expect(edit.head).toBe(3);
  });
});
