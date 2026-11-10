import { afterEach, describe, expect, test, vi } from "vitest";

import { clearMutualCache, mutualFor } from "./mutualCache";

const user = (id: string, fetchMutual: () => Promise<unknown>) =>
  ({ id, fetchMutual }) as unknown as Parameters<typeof mutualFor>[0];

afterEach(() => {
  clearMutualCache();
  vi.useRealTimers();
});

describe("mutual list cache", () => {
  test("opening the same profile again asks the server once", async () => {
    const fetch = vi.fn().mockResolvedValue({ servers: ["s"], users: [] });
    const a = user("A", fetch);
    await mutualFor(a);
    await mutualFor(a);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test("asks again after a minute", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue({ servers: [], users: [] });
    const a = user("A", fetch);
    await mutualFor(a);
    vi.advanceTimersByTime(61_000);
    await mutualFor(a);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  test("a refusal (blocked) shows nothing and is not kept", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce({ type: "MissingPermission" })
      .mockResolvedValue({ servers: [], users: ["u"] });
    const a = user("A", fetch);
    expect(await mutualFor(a)).toBeNull();
    expect(await mutualFor(a)).toEqual({ servers: [], users: ["u"] });
  });
  test("keeps at most fifty people", async () => {
    const fetch = vi.fn().mockResolvedValue({ servers: [], users: [] });
    for (let i = 0; i < 51; i++) await mutualFor(user(`U${i}`, fetch));
    await mutualFor(user("U0", fetch));
    expect(fetch).toHaveBeenCalledTimes(52);
  });
});
