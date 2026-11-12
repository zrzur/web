import { describe, expect, it, vi } from "vitest";

import {
  STALE_RELOAD_GAP_MS,
  STALE_RELOAD_KEY,
  shouldReloadForStaleBuild,
  watchForStaleBuild,
} from "./staleBuild";

describe("stale build after an update", () => {
  it("reloads the first time, not again right after", () => {
    const now = 1_000_000;
    expect(shouldReloadForStaleBuild(now, null)).toBe(true);
    expect(shouldReloadForStaleBuild(now, "nonsense")).toBe(true);
    expect(shouldReloadForStaleBuild(now, String(now - 5_000))).toBe(false);
    expect(
      shouldReloadForStaleBuild(now, String(now - STALE_RELOAD_GAP_MS - 1)),
    ).toBe(true);
  });

  it("reloads the page once when a part of the old build is gone", () => {
    const store = new Map<string, string>();
    const listeners: Record<string, (event: Event) => void> = {};
    const reload = vi.fn();
    const fake = {
      addEventListener: (name: string, fn: (event: Event) => void) => {
        listeners[name] = fn;
      },
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
      location: { reload },
    } as unknown as Window;
    watchForStaleBuild(fake);

    const event = { preventDefault: vi.fn() } as unknown as Event;
    listeners["vite:preloadError"](event);
    expect(reload).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(store.has(STALE_RELOAD_KEY)).toBe(true);

    // a second failure soon after is a real problem: no reload loop
    listeners["vite:preloadError"]({ preventDefault: vi.fn() } as never);
    expect(reload).toHaveBeenCalledOnce();
  });
});
