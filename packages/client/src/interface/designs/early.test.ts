import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EARLY_KINDS,
  clearEarly,
  opensWall,
  startEarlyDesigns,
  takeEarly,
} from "./early";

afterEach(() => {
  clearEarly();
  vi.unstubAllGlobals();
});

describe("the Designs site's first page, asked for early", () => {
  it("knows which addresses open on the wall", () => {
    for (const path of ["/", "", "/looks", "/decorations/", "/community"])
      expect(opensWall(path)).toBe(true);
    for (const path of [
      "/creators",
      "/creator/01ABC",
      "/favourites",
      "/studio",
      "/laurel",
      "/c-01M6SHN0AHBNEZE7APT742WJHM",
    ])
      expect(opensWall(path)).toBe(false);
  });

  it("asks for each kind once, without credentials, as the wall would", () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetch);
    startEarlyDesigns("https://api.example.test/");
    expect(fetch).toHaveBeenCalledTimes(EARLY_KINDS.length);
    for (const kind of EARLY_KINDS)
      expect(fetch).toHaveBeenCalledWith(
        `https://api.example.test/community/${kind}?sort=popular&limit=48`,
        { credentials: "omit" },
      );
  });

  it("hands each answer out once", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({ items: [url], creators: [] }),
      })),
    );
    startEarlyDesigns("https://api.example.test");
    const first = takeEarly<{ items: string[] }>("nameplates");
    expect((await first)?.items[0]).toContain("/community/nameplates?");
    expect(takeEarly("nameplates")).toBeUndefined();
    expect(takeEarly("unknown")).toBeUndefined();
  });

  it("passes a failed answer on as a failure, never as data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
    startEarlyDesigns("https://api.example.test");
    await expect(takeEarly("effects")).rejects.toThrow("503");
  });
});
