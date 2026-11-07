import { describe, expect, it } from "vitest";

import { isOpenableUrl } from "./openableUrl";

describe("isOpenableUrl", () => {
  it("opens web addresses", () => {
    expect(isOpenableUrl("https://example.com/")).toBe(true);
    expect(isOpenableUrl(new URL("http://example.com/"))).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "blob:https://example.com/id",
    "not a url",
    "",
  ])("refuses %s", (value) => {
    expect(isOpenableUrl(value)).toBe(false);
  });
});
