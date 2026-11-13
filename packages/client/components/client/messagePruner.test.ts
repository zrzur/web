import { describe, expect, it } from "vitest";

import { createMessagePruner, holdMessages } from "./messagePruner";

function setup(options: { limit?: number; grace?: number } = {}) {
  const store = new Map<string, { channelId: string }>();
  const kept = new Set<string>();
  const shown = new Set<string>();
  let now = 1_000_000;
  const pruner = createMessagePruner({
    messages: {
      size: () => store.size,
      entries: () => store.entries(),
      delete: (id) => void store.delete(id),
    },
    isKeptChannel: (id) => kept.has(id),
    isShown: (id) => shown.has(id),
    limit: options.limit ?? 4,
    grace: options.grace ?? 1000,
    now: () => now,
  });
  const add = (channel: string, count: number) => {
    for (let i = 0; i < count; i++)
      store.set(`${channel}-${store.size}`, { channelId: channel });
  };
  return {
    store,
    kept,
    shown,
    pruner,
    add,
    wait: (ms: number) => void (now += ms),
    ids: (channel: string) =>
      [...store].filter(([, m]) => m.channelId === channel).map(([id]) => id),
  };
}

describe("message pruner", () => {
  it("does nothing while the cache is small", () => {
    const t = setup({ limit: 10 });
    t.add("a", 6);
    expect(t.pruner.run()).toBe(0);
    t.wait(5000);
    expect(t.pruner.run()).toBe(0);
    expect(t.store.size).toBe(6);
  });

  it("removes messages of channels that are neither open nor kept, after the grace time", () => {
    const t = setup();
    t.add("old", 5);
    t.add("open", 5);
    t.kept.add("open");

    // first pass only marks: something fetched a moment ago may be in use
    expect(t.pruner.run()).toBe(0);
    expect(t.store.size).toBe(10);

    t.wait(999);
    expect(t.pruner.run()).toBe(0);

    t.wait(1);
    expect(t.pruner.run()).toBe(5);
    expect(t.ids("old")).toEqual([]);
    expect(t.ids("open")).toHaveLength(5);
  });

  it("never removes a message that is on screen", () => {
    const t = setup();
    t.add("old", 6);
    const [onScreen] = t.ids("old");
    t.shown.add(onScreen);
    t.pruner.run();
    t.wait(1000);
    expect(t.pruner.run()).toBe(5);
    expect(t.ids("old")).toEqual([onScreen]);
  });

  it("never removes a message another part of the app holds", () => {
    const t = setup();
    t.add("old", 6);
    const [held] = t.ids("old");
    const release = holdMessages(() => [held]);
    t.pruner.run();
    t.wait(1000);
    expect(t.pruner.run()).toBe(5);
    expect(t.ids("old")).toEqual([held]);

    // let go: it is marked now and removed one grace time later
    t.add("open", 5);
    t.kept.add("open");
    release();
    expect(t.pruner.run()).toBe(0);
    t.wait(1000);
    expect(t.pruner.run()).toBe(1);
    expect(t.ids("old")).toEqual([]);
    expect(t.ids("open")).toHaveLength(5);
  });

  it("starts the grace time again when a channel was opened in between", () => {
    const t = setup();
    t.add("a", 6);
    t.pruner.run();
    t.wait(600);
    // the person went back to the channel…
    t.kept.add("a");
    expect(t.pruner.run()).toBe(0);
    // …and left it again
    t.kept.delete("a");
    t.wait(600);
    expect(t.pruner.run()).toBe(0);
    expect(t.store.size).toBe(6);
    t.wait(1000);
    expect(t.pruner.run()).toBe(6);
  });

  it("messages fetched after a pass get their own grace time", () => {
    const t = setup();
    t.add("a", 6);
    t.pruner.run();
    t.wait(900);
    t.add("b", 3);
    t.pruner.run();
    t.wait(100);
    expect(t.pruner.run()).toBe(6);
    expect(t.ids("b")).toHaveLength(3);
  });

  it("forgets its marks when the cache is small again", () => {
    const t = setup({ limit: 4 });
    t.add("a", 6);
    t.pruner.run();
    t.store.clear();
    t.add("a", 3);
    t.wait(5000);
    expect(t.pruner.run()).toBe(0);
    t.add("a", 3);
    // above the limit again: a fresh grace time, nothing removed at once
    expect(t.pruner.run()).toBe(0);
    expect(t.store.size).toBe(6);
  });
});
