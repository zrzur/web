import { describe, expect, it } from "vitest";

import { isAppNavigation, isRuntimeAsset, overLimit } from "./runtimeAssets";

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

  it("answers for pages of the app being opened, nothing else", () => {
    const nav = { mode: "navigate" };
    expect(isAppNavigation(nav, url("/"), origin, "/")).toBe(true);
    expect(
      isAppNavigation(nav, url("/server/01/channel/02"), origin, "/"),
    ).toBe(true);
    // a request made by the page (API, images, files) is never touched
    expect(isAppNavigation({ mode: "cors" }, url("/app"), origin, "/")).toBe(
      false,
    );
    expect(isAppNavigation({ mode: "no-cors" }, url("/"), origin, "/")).toBe(
      false,
    );
    // a file opened directly keeps its real answer (a missing one is a 404)
    expect(isAppNavigation(nav, url("/build.json"), origin, "/")).toBe(false);
    expect(isAppNavigation(nav, url("/assets/web/logo.png"), origin, "/")).toBe(
      false,
    );
    // another site, or a page outside the scope
    expect(
      isAppNavigation(nav, new URL("https://api.zrzur.com/"), origin, "/"),
    ).toBe(false);
    expect(isAppNavigation(nav, url("/other"), origin, "/app/")).toBe(false);
  });

  it("drops only the oldest entries over the limit", () => {
    expect(overLimit([1, 2, 3, 4], 2)).toEqual([1, 2]);
    expect(overLimit([1, 2], 2)).toEqual([]);
  });
});
