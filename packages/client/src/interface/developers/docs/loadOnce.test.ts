import { describe, expect, it, vi } from "vitest";

import { loadOnce } from "./loadOnce";

describe("loadOnce", () => {
  it("fetches a key once while it succeeds", async () => {
    const cache = new Map<string, Promise<number>>();
    const load = vi.fn(async () => 1);
    await loadOnce(cache, "a", load);
    await loadOnce(cache, "a", load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("forgets a failed fetch, so the next call tries again", async () => {
    const cache = new Map<string, Promise<number>>();
    const load = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(2);
    await expect(loadOnce(cache, "a", load)).rejects.toThrow("offline");
    expect(cache.has("a")).toBe(false);
    await expect(loadOnce(cache, "a", load)).resolves.toBe(2);
  });
});
