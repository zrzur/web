import { describe, expect, it, vi } from "vitest";

import {
  STALE_RELOAD_GAP_MS,
  STALE_RELOAD_KEY,
  holdStaleReload,
  shouldReloadForStaleBuild,
  watchForStaleBuild,
} from "./staleBuild";

import { lazy } from "../components/common/lib/lazyPart";

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

  it("never reloads while a call holds it, and again after", () => {
    const listeners: Record<string, (event: Event) => void> = {};
    const reload = vi.fn();
    const fake = {
      addEventListener: (name: string, fn: (event: Event) => void) => {
        listeners[name] = fn;
      },
      sessionStorage: { getItem: () => null, setItem: () => undefined },
      location: { reload },
    } as unknown as Window;
    watchForStaleBuild(fake);
    const release = holdStaleReload();
    const event = { preventDefault: vi.fn() } as unknown as Event;
    listeners["vite:preloadError"](event);
    expect(reload).not.toHaveBeenCalled();
    // the failure reaches the part that asked for the file
    expect(event.preventDefault).not.toHaveBeenCalled();
    release();
    listeners["vite:preloadError"](event);
    expect(reload).toHaveBeenCalledOnce();
  });
  /** A page that knows its commit, and what the server answers */
  function page(server: string | undefined) {
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
    watchForStaleBuild(fake, {
      runningCommit: "aaaa111",
      serverCommit: async () => server,
    });
    const fail = async () => {
      const event = { preventDefault: vi.fn() } as unknown as Event;
      listeners["vite:preloadError"](event);
      await Promise.resolve();
      await Promise.resolve();
      return event;
    };
    return { reload, fail };
  }

  it("does not reload when the same build is still on the server", async () => {
    const { reload, fail } = page("aaaa111");
    const event = await fail();
    await fail();
    expect(reload).not.toHaveBeenCalled();
    // the failure reaches the part that asked for the file: it retries
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("does not reload when the server cannot be asked (no connection)", async () => {
    const { reload, fail } = page(undefined);
    await fail();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when the server has another build", async () => {
    const { reload, fail } = page("bbbb222");
    await fail();
    expect(reload).toHaveBeenCalledOnce();
    // known now: the next failure is handled at once, and not twice in a row
    const next = await fail();
    expect(reload).toHaveBeenCalledOnce();
    expect(next.preventDefault).not.toHaveBeenCalled();
  });

  describe("a part that failed twice in a row while online (Safari keeps failed modules)", () => {
    const failingPart = () =>
      lazy(() =>
        Promise.reject(new TypeError("Importing a module script failed.")),
      );
    const twice = async (part: ReturnType<typeof failingPart>) => {
      await part.preload().catch(() => undefined);
      await part.preload().catch(() => undefined);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    };

    it("reloads when the server answers, even with the same build", async () => {
      const { reload } = page("aaaa111");
      await twice(failingPart());
      expect(reload).toHaveBeenCalledOnce();
    });

    it("does not reload when the server cannot be asked (no connection)", async () => {
      const { reload } = page(undefined);
      await twice(failingPart());
      expect(reload).not.toHaveBeenCalled();
    });

    it("does not reload after one failure", async () => {
      const { reload } = page("aaaa111");
      await failingPart()
        .preload()
        .catch(() => undefined);
      for (let i = 0; i < 5; i++) await Promise.resolve();
      expect(reload).not.toHaveBeenCalled();
    });

    it("never reloads during a call", async () => {
      const { reload } = page("aaaa111");
      const release = holdStaleReload();
      await twice(failingPart());
      release();
      expect(reload).not.toHaveBeenCalled();
    });
  });
});
