import { describe, expect, it } from "vitest";

import { createActivitySender } from "./activitySender";

function clock() {
  let time = 0;
  const timers: { at: number; run: () => void }[] = [];
  return {
    now: () => time,
    setTimer: (run: () => void, ms: number) => {
      const timer = { at: time + ms, run };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer: unknown) => {
      const i = timers.indexOf(timer as never);
      if (i >= 0) timers.splice(i, 1);
    },
    advance(ms: number) {
      const end = time + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        time = next.at;
        next.run();
      }
      time = end;
    },
  };
}

function setup() {
  const c = clock();
  const sent: [string, unknown][] = [];
  const sender = createActivitySender<{ name: string }>({
    send: (source, activity) => sent.push([source, activity]),
    gap: 4500,
    now: c.now,
    setTimer: c.setTimer,
    clearTimer: c.clearTimer,
  });
  return { c, sent, sender };
}

describe("sending the desktop's activity", () => {
  it("sends the first change at once", () => {
    const { sent, sender } = setup();
    sender.set("Desktop", { name: "Code" });
    expect(sent).toEqual([["Desktop", { name: "Code" }]]);
  });

  it("keeps to one message per gap, newest value wins", () => {
    const { c, sent, sender } = setup();
    sender.set("Desktop", { name: "A" });
    sender.set("Desktop", { name: "B" });
    sender.set("Desktop", { name: "C" });
    expect(sent).toHaveLength(1);
    c.advance(4500);
    expect(sent).toEqual([
      ["Desktop", { name: "A" }],
      ["Desktop", { name: "C" }],
    ]);
  });

  it("never passes 5 messages in 20 seconds, however often it changes", () => {
    const { c, sent, sender } = setup();
    const at: number[] = [];
    for (let i = 0; i < 300; i++) {
      const before = sent.length;
      sender.set(i % 2 ? "Rpc" : "Desktop", { name: `n${i}` });
      c.advance(200);
      for (let k = before; k < sent.length; k++) at.push(c.now());
    }
    expect(sent.length).toBeGreaterThan(5);
    // every 20 s window holds at most 5 messages
    for (const start of at) {
      expect(
        at.filter((t) => t >= start && t < start + 20_000).length,
      ).toBeLessThanOrEqual(5);
    }
  });

  it("does not send what the server already has", () => {
    const { c, sent, sender } = setup();
    sender.set("Rpc", { name: "Game" });
    c.advance(5000);
    sender.set("Rpc", { name: "Game" });
    c.advance(5000);
    expect(sent).toHaveLength(1);
    // clearing something never set sends nothing
    sender.set("Desktop", null);
    c.advance(5000);
    expect(sent).toHaveLength(1);
  });

  it("sends both sources, one after the other", () => {
    const { c, sent, sender } = setup();
    sender.set("Rpc", { name: "Game" });
    sender.set("Desktop", { name: "Code" });
    c.advance(4500);
    expect(sent.map(([s]) => s)).toEqual(["Rpc", "Desktop"]);
  });

  it("sends again after a reconnect, but not a clear", () => {
    const { c, sent, sender } = setup();
    sender.set("Rpc", { name: "Game" });
    sender.set("Desktop", null);
    c.advance(10_000);
    expect(sent).toHaveLength(1);
    sender.reconnected();
    c.advance(10_000);
    expect(sent).toEqual([
      ["Rpc", { name: "Game" }],
      ["Rpc", { name: "Game" }],
    ]);
  });

  it("stops its timer", () => {
    const { c, sent, sender } = setup();
    sender.set("Rpc", { name: "A" });
    sender.set("Rpc", { name: "B" });
    sender.stop();
    c.advance(10_000);
    expect(sent).toHaveLength(1);
  });
});
