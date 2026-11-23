import { describe, expect, it } from "vitest";

import { editorTextChanged } from "./editorDirty";

describe("editorTextChanged", () => {
  it("is not an edit when only the stored end of line is gone", () => {
    expect(
      editorTextChanged("Answers questions.", ["Answers questions.\n"]),
    ).toBe(false);
  });

  it("is not an edit for an empty field with no start value", () => {
    expect(editorTextChanged("", undefined)).toBe(false);
  });

  it("is an edit when the words differ", () => {
    expect(editorTextChanged("New bio", ["Answers questions."])).toBe(true);
  });
});
