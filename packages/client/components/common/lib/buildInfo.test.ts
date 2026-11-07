import { describe, expect, it } from "vitest";

import { SOURCE_CODE_URL, buildInfo, serverBuildOf, shortCommit } from "./buildInfo";

describe("serverBuildOf", () => {
  it("links the server to its own commit", () => {
    expect(serverBuildOf({ zrzur: "26.0.0", commit: "abc1234def" })).toEqual({
      version: "26.0.0",
      commit: "abc1234def",
      sourceUrl: "https://github.com/zrzur/backend/tree/abc1234def",
    });
  });
  it("falls back to the repository when the server sends no commit", () => {
    expect(serverBuildOf({ zrzur: "26.0.0" })?.sourceUrl).toBe(
      "https://github.com/zrzur/backend",
    );
    expect(serverBuildOf({ zrzur: "26.0.0", commit: "x/../y" })?.commit).toBe("");
    expect(serverBuildOf(undefined)).toBeNull();
  });
});

describe("buildInfo", () => {
  it("falls back to the repository root when no build info is injected", () => {
    expect(buildInfo.version).toBeTruthy();
    expect(SOURCE_CODE_URL).toBe("https://github.com/zrzur/web");
  });

  it("shortens a commit to 7 characters and tolerates none", () => {
    expect(shortCommit({ commit: "0123456789abcdef" })).toBe("0123456");
    expect(shortCommit({ commit: "" })).toBe("");
  });
});
