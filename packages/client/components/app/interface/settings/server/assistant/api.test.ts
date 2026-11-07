import { describe, expect, it } from "vitest";

import { codeFrom, makePkce, tabsOf } from "./helpers";

describe("assistant settings client", () => {
  it("makes a URL-safe verifier and a matching challenge", async () => {
    const { verifier, challenge } = await makePkce();
    expect(verifier).toMatch(/^[\w-]{43}$/);
    expect(challenge).toMatch(/^[\w-]{43}$/);
    expect(challenge).not.toBe(verifier);
  });

  it("takes the code only from a redirect with our state", () => {
    const redirect = "https://x.example/oauth/callback?code=abc&state=mine";
    expect(codeFrom(redirect, "mine")).toBe("abc");
    expect(codeFrom(redirect, "other")).toBeNull();
  });

  it("hides the messages tab when a module has none", () => {
    expect(tabsOf({ messages: [] })).toEqual([
      "settings",
      "permissions",
      "log",
      "data",
    ]);
    expect(tabsOf({ messages: [{ key: "a", defaults: {} }] })).toContain(
      "messages",
    );
  });
});
