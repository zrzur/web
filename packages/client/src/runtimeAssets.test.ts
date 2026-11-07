import { describe, expect, it } from "vitest";

import { isRuntimeAsset, overLimit } from "./runtimeAssets";

const origin = "https://app.zrzur.com";
const url = (path: string) => new URL(path, origin);

describe("runtime asset cache", () => {
  it("takes hashed scripts, styles and fonts of this site", () => {
    expect(isRuntimeAsset(url("/assets/Settings-a1.js"), origin, "/")).toBe(
      true,
    );
    expect(isRuntimeAsset(url("/assets/400-a1.css"), origin, "/")).toBe(true);
    expect(isRuntimeAsset(url("/assets/plex-a1.woff2"), origin, "/")).toBe(
      true,
    );
  });

  it("leaves other paths and other sites alone", () => {
    expect(isRuntimeAsset(url("/index.html"), origin, "/")).toBe(false);
    expect(isRuntimeAsset(url("/assets/web/logo.png"), origin, "/")).toBe(
      false,
    );
    expect(
      isRuntimeAsset(new URL("https://cdn.zrzur.com/assets/a.js"), origin, "/"),
    ).toBe(false);
  });

  it("follows the scope of the service worker", () => {
    expect(isRuntimeAsset(url("/app/assets/a.js"), origin, "/app/")).toBe(true);
    expect(isRuntimeAsset(url("/assets/a.js"), origin, "/app/")).toBe(false);
  });

  it("drops only the oldest entries over the limit", () => {
    expect(overLimit([1, 2, 3, 4], 2)).toEqual([1, 2]);
    expect(overLimit([1, 2], 2)).toEqual([]);
  });
});
