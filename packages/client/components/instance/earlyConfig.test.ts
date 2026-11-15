import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearEarlyConfig,
  startEarlyConfig,
  takeEarlyConfig,
} from "./earlyConfig";

afterEach(() => {
  clearEarlyConfig();
  vi.unstubAllGlobals();
});

describe("the server's configuration, asked for by the first code", () => {
  it("asks once, without credentials, at the API's root", () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetch);
    startEarlyConfig("https://api.example.test/");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("https://api.example.test/", {
      credentials: "omit",
    });
  });

  it("hands the answer out once, and only for the same server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ws: "w" }) })),
    );
    startEarlyConfig("https://api.example.test");
    expect(takeEarlyConfig("https://other.example.test")).toBeUndefined();
    expect(await takeEarlyConfig("https://api.example.test/")).toEqual({
      ws: "w",
    });
    expect(takeEarlyConfig("https://api.example.test")).toBeUndefined();
  });

  it("passes a failed answer on as a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })),
    );
    startEarlyConfig("https://api.example.test");
    await expect(takeEarlyConfig("https://api.example.test")).rejects.toThrow(
      "429",
    );
  });
});
