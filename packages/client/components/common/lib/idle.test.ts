// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { whenIdleAndEvery } from "./idle";

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

describe("whenIdleAndEvery", () => {
  it("waits for the first screen, then checks on its schedule", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const stop = whenIdleAndEvery(run, 10_000);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(30_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("sends nothing from a hidden tab", () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    const run = vi.fn();
    const stop = whenIdleAndEvery(run, 10_000);
    vi.advanceTimersByTime(60_000);
    expect(run).not.toHaveBeenCalled();
    stop();
  });
});
