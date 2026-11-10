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
    await mutualFor(a, "V");
    await mutualFor(a, "V");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test("asks again after a minute", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue({ servers: [], users: [] });
    const a = user("A", fetch);
    await mutualFor(a, "V");
    vi.advanceTimersByTime(61_000);
    await mutualFor(a, "V");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  test("a refusal (blocked) shows nothing and is not kept", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce({ type: "MissingPermission" })
      .mockResolvedValue({ servers: [], users: ["u"] });
    const a = user("A", fetch);
    expect(await mutualFor(a, "V")).toBeNull();
    expect(await mutualFor(a, "V")).toEqual({ servers: [], users: ["u"] });
  });
  test("keeps at most fifty people", async () => {
    const fetch = vi.fn().mockResolvedValue({ servers: [], users: [] });
    for (let i = 0; i < 51; i++) await mutualFor(user(`U${i}`, fetch), "V");
    await mutualFor(user("U0", fetch), "V");
    expect(fetch).toHaveBeenCalledTimes(52);
  });

  test("another account on this device asks for itself", async () => {
    const fetch = vi.fn().mockResolvedValue({ servers: ["s"], users: [] });
    const a = user("A", fetch);
    await mutualFor(a, "V1");
    await mutualFor(a, "V2");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  test("a late refusal never drops a newer list", async () => {
    vi.useFakeTimers();
    let refuse: (error: unknown) => void = () => {};
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise((_, reject) => (refuse = reject)),
      )
      .mockResolvedValue({ servers: ["new"], users: [] });
    const a = user("A", fetch);
    const old = mutualFor(a, "V");
    vi.advanceTimersByTime(61_000);
    expect(await mutualFor(a, "V")).toEqual({ servers: ["new"], users: [] });
    refuse({ type: "MissingPermission" });
    expect(await old).toBeNull();
    await mutualFor(a, "V");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
