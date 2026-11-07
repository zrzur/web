import { describe, expect, it } from "vitest";

import { needsRichMarkdown } from "./needsRich";

describe("needsRichMarkdown", () => {
  it("is false for everyday messages", () => {
    expect(needsRichMarkdown("hello **there** `inline` $5")).toBe(false);
    expect(needsRichMarkdown("```\nplain block\n```")).toBe(false);
  });

  it("is true for maths and code with a language", () => {
    expect(needsRichMarkdown("$$x^2$$")).toBe(true);
    expect(needsRichMarkdown("```ts\nconst a = 1;\n```")).toBe(true);
    expect(needsRichMarkdown("``` c++\nint a;\n```")).toBe(true);
  });
});
