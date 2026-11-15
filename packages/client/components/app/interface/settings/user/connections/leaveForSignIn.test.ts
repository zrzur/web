import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SIGN_IN_STUCK_AFTER_MS, leaveForSignIn } from "./leaveForSignIn";

/** A page with its own listeners, address and visibility */
function fakePage() {
  const listeners = new Map<string, Set<() => void>>();
  const page = {
    assign: vi.fn(),
    visibility: "visible" as "visible" | "hidden",
    fire: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
    count: (type: string) => listeners.get(type)?.size ?? 0,
  };
  vi.stubGlobal("window", {
    location: { assign: page.assign },
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) =>
      listeners.get(type)?.delete(fn),
  });
  vi.stubGlobal("document", {
    get visibilityState() {
      return page.visibility;
    },
  });
  return page;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("leaveForSignIn", () => {
  it("goes to the sign-in page", () => {
    const page = fakePage();
    leaveForSignIn("https://id.twitch.tv/oauth2/authorize?x", vi.fn());
    expect(page.assign).toHaveBeenCalledWith("https://id.twitch.tv/oauth2/authorize?x");
  });

  it("a page that leaves never counts as stuck", () => {
    const page = fakePage();
    const stuck = vi.fn();
    leaveForSignIn("https://github.com/login/oauth/authorize", stuck);
    page.fire("pagehide");
    vi.advanceTimersByTime(SIGN_IN_STUCK_AFTER_MS * 2);
    expect(stuck).not.toHaveBeenCalled();
    expect(page.count("pagehide")).toBe(0);
  });

  it("a blocked navigation counts as stuck after the delay", () => {
    const page = fakePage();
    const stuck = vi.fn();
    leaveForSignIn("https://oauth.battle.net/authorize", stuck);
    // a blocked navigation can still run beforeunload: that is not leaving
    page.fire("beforeunload");
    vi.advanceTimersByTime(SIGN_IN_STUCK_AFTER_MS - 1);
    expect(stuck).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(stuck).toHaveBeenCalledTimes(1);
    expect(page.count("pagehide")).toBe(0);
  });

  it("a hidden page is not stuck: the sign-in opened elsewhere", () => {
    const page = fakePage();
    const stuck = vi.fn();
    leaveForSignIn("https://steamcommunity.com/openid/login", stuck);
    page.visibility = "hidden";
    vi.advanceTimersByTime(SIGN_IN_STUCK_AFTER_MS);
    expect(stuck).not.toHaveBeenCalled();
  });

  it("stopping early cancels the wait", () => {
    fakePage();
    const stuck = vi.fn();
    const stop = leaveForSignIn("https://id.twitch.tv/x", stuck);
    stop();
    vi.advanceTimersByTime(SIGN_IN_STUCK_AFTER_MS);
    expect(stuck).not.toHaveBeenCalled();
  });
});
