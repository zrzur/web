import { describe, expect, it } from "vitest";

import { charCount, isHttpsLink } from "./verificationLinks";

// the server's required_link: https, a host, no password, no spaces
describe("isHttpsLink", () => {
  it("takes what the server takes", () => {
    expect(isHttpsLink("https://example.org/privacy")).toBe(true);
    expect(isHttpsLink("  https://example.org  ")).toBe(true);
  });
  it("refuses what the server refuses", () => {
    expect(isHttpsLink("http://example.org")).toBe(false);
    expect(isHttpsLink("example.org/privacy")).toBe(false);
    expect(isHttpsLink("https://")).toBe(false);
    expect(isHttpsLink("https://user:pass@example.org")).toBe(false);
    expect(isHttpsLink("https://example.org/a b")).toBe(false);
  });
});

describe("charCount", () => {
  it("counts an emoji as one character, like the server", () => {
    expect(charCount(" 😀😀 ")).toBe(2);
  });
});
