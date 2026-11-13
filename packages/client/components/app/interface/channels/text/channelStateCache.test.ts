import { describe, expect, it } from "vitest";

import { createChannelStateCache } from "./channelStateCache";

describe("channel state cache", () => {
  it("gives a channel's state back once", () => {
    const cache = createChannelStateCache<string>(3);
    cache.manage("a", "state a");
    expect(cache.unmanage("a")).toBe("state a");
    expect(cache.unmanage("a")).toBeUndefined();
  });

  it("keeps only the most recently left channels", () => {
    const cache = createChannelStateCache<string>(3);
    for (const id of ["a", "b", "c", "d"]) cache.manage(id, id);
    expect(cache.unmanage("a")).toBeUndefined();
    expect(cache.unmanage("b")).toBe("b");
    expect(cache.unmanage("d")).toBe("d");
  });

  it("leaving a channel again makes it the most recent", () => {
    const cache = createChannelStateCache<string>(3);
    for (const id of ["a", "b", "c"]) cache.manage(id, id);
    cache.manage("a", "a again");
    cache.manage("d", "d");
    expect(cache.unmanage("b")).toBeUndefined();
    expect(cache.unmanage("a")).toBe("a again");
  });

  it("knows which channels still need their messages", () => {
    const cache = createChannelStateCache<string>(2);
    cache.opened("open");
    cache.manage("left", "state");
    expect(cache.isKept("open")).toBe(true);
    expect(cache.isKept("left")).toBe(true);
    expect(cache.isKept("other")).toBe(false);

    cache.closed("open");
    expect(cache.isKept("open")).toBe(false);
  });

  it("a channel open in two places stays kept until both are closed", () => {
    const cache = createChannelStateCache<string>(2);
    cache.opened("a");
    cache.opened("a");
    cache.closed("a");
    expect(cache.isKept("a")).toBe(true);
    cache.closed("a");
    expect(cache.isKept("a")).toBe(false);
  });

  it("reads and changes the kept states, and clears them", () => {
    const cache = createChannelStateCache<string>(3);
    cache.manage("a", "one");
    expect(cache.get("a")).toBe("one");
    cache.set("a", "two");
    cache.set("unknown", "ignored");
    expect(cache.get("unknown")).toBeUndefined();
    cache.clear();
    expect(cache.unmanage("a")).toBeUndefined();
    expect(cache.isKept("a")).toBe(false);
  });
});
