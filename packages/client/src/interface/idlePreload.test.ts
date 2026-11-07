import { afterEach, describe, expect, it, vi } from "vitest";

import { canLoadAhead, preloadWhenIdle } from "./idlePreload";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubBrowser(connection?: object) {
  const queue: (() => void)[] = [];
  const window = {
    requestIdleCallback: (fn: () => void) => queue.push(fn),
    cancelIdleCallback: (id: number) => queue.splice(id - 1, 1),
  };
  vi.stubGlobal("window", window);
  vi.stubGlobal("navigator", { connection });
  return queue;
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  vi.advanceTimersByTime(5_000);
};

describe("canLoadAhead", () => {
  it("respects data saver and very slow connections", () => {
    expect(canLoadAhead()).toBe(true);
    expect(canLoadAhead({ effectiveType: "4g" })).toBe(true);
    expect(canLoadAhead({ saveData: true })).toBe(false);
    expect(canLoadAhead({ effectiveType: "2g" })).toBe(false);
    expect(canLoadAhead({ effectiveType: "slow-2g" })).toBe(false);
  });
});

describe("preloadWhenIdle", () => {
  it("loads one piece per idle moment, in order", async () => {
    vi.useFakeTimers();
    const queue = stubBrowser();
    const done: string[] = [];
    preloadWhenIdle([
      async () => done.push("first"),
      async () => done.push("second"),
    ]);

    expect(done).toEqual([]);
    queue.shift()!();
    await flush();
    expect(done).toEqual(["first"]);
    queue.shift()!();
    await flush();
    expect(done).toEqual(["first", "second"]);
    expect(queue).toEqual([]);
  });

  it("leaves a pause between pieces", async () => {
    vi.useFakeTimers();
    const queue = stubBrowser();
    preloadWhenIdle([async () => undefined, async () => undefined]);

    queue.shift()!();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    vi.advanceTimersByTime(4_999);
    expect(queue).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(queue).toHaveLength(1);
  });

  it("carries on after a piece fails", async () => {
    vi.useFakeTimers();
    const queue = stubBrowser();
    const second = vi.fn(async () => undefined);
    preloadWhenIdle([() => Promise.reject(new Error("offline")), second]);

    queue.shift()!();
    await flush();
    queue.shift()!();
    await flush();
    expect(second).toHaveBeenCalledOnce();
  });

  it("stops before the next piece when cancelled", async () => {
    vi.useFakeTimers();
    const queue = stubBrowser();
    const second = vi.fn(async () => undefined);
    const cancel = preloadWhenIdle([async () => undefined, second]);

    queue.shift()!();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    cancel();
    vi.advanceTimersByTime(60_000);
    expect(queue).toEqual([]);
    expect(second).not.toHaveBeenCalled();
  });

  it("drops a piece still waiting for an idle moment when cancelled", () => {
    const queue = stubBrowser();
    const load = vi.fn(async () => undefined);
    const cancel = preloadWhenIdle([load]);

    cancel();
    expect(queue).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it("loads nothing with data saver on", () => {
    const queue = stubBrowser({ saveData: true });
    const load = vi.fn(async () => undefined);
    preloadWhenIdle([load]);

    expect(queue).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
});
