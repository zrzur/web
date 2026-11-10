import { describe, expect, it } from "vitest";

import { editableByMe } from "./editable";

describe("editableByMe", () => {
  it("is your own plain message", () => {
    expect(editableByMe({ author: { self: true } })).toBe(true);
    expect(editableByMe({ author: { self: false } })).toBe(false);
  });

  it("is never a forwarded copy or a poll (the server refuses both)", () => {
    expect(
      editableByMe({ author: { self: true }, forwarded: { message: "M" } }),
    ).toBe(false);
    expect(
      editableByMe({ author: { self: true }, poll: { question: "q" } }),
    ).toBe(false);
  });
});
