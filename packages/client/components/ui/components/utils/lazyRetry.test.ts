import { describe, expect, it, vi } from "vitest";

import { loadWithRetry } from "./lazyRetry";

describe("loadWithRetry", () => {
  it("uses the part when it loads", async () => {
    const load = vi.fn().mockResolvedValue({ default: "part" });
    expect(await loadWithRetry(load, "fallback", 0)).toEqual({ default: "part" });
    expect(load).toHaveBeenCalledOnce();
  });

  it("tries once more after a failed load", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ default: "part" });
    expect(await loadWithRetry(load, "fallback", 0)).toEqual({ default: "part" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows the fallback instead of throwing when both tries fail", async () => {
    const load = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await loadWithRetry(load, "fallback", 0)).toEqual({
      default: "fallback",
    });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
