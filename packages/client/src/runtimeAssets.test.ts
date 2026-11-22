import { describe, expect, it } from "vitest";

import {
  ASSET_TRY_TIMEOUT_MS,
  fetchWithRetry,
  isAppNavigation,
  isRuntimeAsset,
  isRuntimeImage,
  overLimit,
} from "./runtimeAssets";

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

describe("a file that does not arrive", () => {
  const none = async () => undefined;

  it("is asked for again after a lost request, and the page gets the file", async () => {
    let tries = 0;
    const answer = await fetchWithRetry(
      async () => {
        if (++tries < 3) throw new TypeError("Failed to fetch");
        return { status: 200 };
      },
      [0, 1, 1],
      none,
    );
    expect(answer.status).toBe(200);
    expect(tries).toBe(3);
  });

  it("is asked for again after a server error", async () => {
    let tries = 0;
    const answer = await fetchWithRetry(
      async () => ({ status: ++tries < 2 ? 503 : 200 }),
      [0, 1, 1],
      none,
    );
    expect(answer.status).toBe(200);
    expect(tries).toBe(2);
  });

  it("takes not found as the answer, without asking again", async () => {
    let tries = 0;
    const answer = await fetchWithRetry(
      async () => ({ status: (tries++, 404) }),
      [0, 1, 1],
      none,
    );
    expect(answer.status).toBe(404);
    expect(tries).toBe(1);
  });

  it("fails only after every try failed", async () => {
    let tries = 0;
    await expect(
      fetchWithRetry(
        async () => {
          tries++;
          throw new TypeError("Failed to fetch");
        },
        [0, 1, 1],
        none,
      ),
    ).rejects.toThrow("Failed to fetch");
    expect(tries).toBe(3);
  });
});

describe("a try that hangs (half-dead connection)", () => {
  const none = async () => undefined;

  it("gives each try its own time limit, then asks again", async () => {
    let tries = 0;
    const answer = await fetchWithRetry(
      (signal: AbortSignal) => {
        tries++;
        if (tries < 3)
          // never answers: only the time limit ends it
          return new Promise<{ status: number }>((_, reject) =>
            signal?.addEventListener("abort", () => reject(signal.reason)),
          );
        return Promise.resolve({ status: 200 });
      },
      [0, 1, 1],
      none,
      20,
    );
    expect(answer.status).toBe(200);
    expect(tries).toBe(3);
  });

  it("fails when every try runs out of time", async () => {
    let tries = 0;
    await expect(
      fetchWithRetry(
        (signal: AbortSignal) => {
          tries++;
          return new Promise<{ status: number }>((_, reject) =>
            signal?.addEventListener("abort", () => reject(signal.reason)),
          );
        },
        [0, 1, 1],
        none,
        20,
      ),
    ).rejects.toBeDefined();
    expect(tries).toBe(3);
  });

  it("allows about nine seconds per try by default", () => {
    expect(ASSET_TRY_TIMEOUT_MS).toBeGreaterThanOrEqual(8000);
    expect(ASSET_TRY_TIMEOUT_MS).toBeLessThanOrEqual(10000);
  });
});

describe("the app's own pictures", () => {
  const origin = "https://app.zrzur.com";
  const at = (path: string) => new URL(path, origin);
  const image = { destination: "image" };

  it("are kept: default avatars, the logo, design art", () => {
    expect(
      isRuntimeImage(image, at("/avatars/avatar-12-ocean.svg"), origin, "/"),
    ).toBe(true);
    expect(
      isRuntimeImage(image, at("/brand/mark-white.svg?v=b-1"), origin, "/"),
    ).toBe(true);
    expect(isRuntimeImage(image, at("/assets/web/icon.png"), origin, "/")).toBe(
      true,
    );
  });

  it("are never what people upload, which lives at another address", () => {
    expect(
      isRuntimeImage(
        image,
        new URL("https://cdn.zrzur.com/avatars/abc/photo.png"),
        origin,
        "/",
      ),
    ).toBe(false);
  });

  it("are only pictures, asked for as pictures, inside the app", () => {
    expect(
      isRuntimeImage({ destination: "" }, at("/avatars/a.svg"), origin, "/"),
    ).toBe(false);
    expect(isRuntimeImage(image, at("/build.json"), origin, "/")).toBe(false);
    expect(isRuntimeImage(image, at("/avatars/a.svg"), origin, "/app/")).toBe(
      false,
    );
  });
});
