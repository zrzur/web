import { describe, expect, it, vi } from "vitest";

import {
  STALE_RELOAD_GAP_MS,
  STALE_RELOAD_KEY,
  holdStaleReload,
  isWebKit,
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
});

describe("WebKit (the only engine that keeps a failed module)", () => {
  const ua = {
    iphoneSafari:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    iphoneChrome:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
    macSafari:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    macChrome:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    androidChrome:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    windowsEdge:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    firefox:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  };

  it("is Safari and every browser on iPhone and iPad", () => {
    expect(isWebKit(ua.iphoneSafari)).toBe(true);
    expect(isWebKit(ua.iphoneChrome)).toBe(true);
    expect(isWebKit(ua.macSafari)).toBe(true);
    // an iPad asking for the desktop site
    expect(isWebKit(ua.macSafari, 5)).toBe(true);
  });

  it("is not Chrome, Edge or Firefox elsewhere", () => {
    expect(isWebKit(ua.macChrome)).toBe(false);
    expect(isWebKit(ua.androidChrome)).toBe(false);
    expect(isWebKit(ua.windowsEdge)).toBe(false);
    expect(isWebKit(ua.firefox)).toBe(false);
  });
});
