import { describe, expect, it } from "vitest";

import {
  type HistorySource,
  type HistoryState,
  type HistoryView,
  type ViewMove,
  createHistory,
} from "./controller";

type Msg = { id: string; mine?: boolean };
const id = (n: number) => `M${String(n).padStart(5, "0")}`;
const num = (m: { id: string }) => Number(m.id.slice(1));

/** A channel of `total` messages that answers like the server does */
function channel(total: number) {
  const calls: string[] = [];
  let fail = false;
  let hang = false;
  const gates: (() => void)[] = [];
  let gated = false;
  const all = () =>
    Array.from({ length: total }, (_, i) => ({ id: id(i + 1) }));

  async function answer(name: string, rows: Msg[]) {
    calls.push(name);
    if (hang) return new Promise<Msg[]>(() => {});
    if (gated) await new Promise<void>((open) => gates.push(open));
    if (fail) throw new Error("network");
    return rows;
  }

  const source: HistorySource<Msg> = {
    latest: (limit) =>
      answer(`latest ${limit}`, all().reverse().slice(0, limit)),
    before: (from, limit) =>
      answer(
        `before ${num({ id: from })}`,
        all()
          .filter((m) => m.id < from)
          .reverse()
          .slice(0, limit),
      ),
    after: (from, limit) =>
      answer(
        `after ${num({ id: from })}`,
        all()
          .filter((m) => m.id > from)
          .slice(0, limit),
      ),
    nearby: (target, limit) => {
      const half = Math.floor(limit / 2) + 1;
      return answer(`nearby ${num({ id: target })}`, [
        ...all()
          .filter((m) => m.id >= target)
          .slice(0, half),
        ...all()
          .filter((m) => m.id < target)
          .reverse()
          .slice(0, half),
      ]);
    },
  };

  return {
    source,
    calls,
    add: () => ({ id: id(++total) }),
    failing: (on: boolean) => (fail = on),
    hanging: (on: boolean) => (hang = on),
    gate: (on: boolean) => (gated = on),
    release: () => gates.splice(0).forEach((open) => open()),
  };
}

function setup(total: number, options: { timeoutMs?: number } = {}) {
  const ch = channel(total);
  const moves: ViewMove[] = [];
  const commits: number[] = [];
  let atPresent = true;
  let rowLimit = 150;
  let touching: Promise<void> | undefined;
  let liftFinger = () => {};
  let state!: HistoryState<Msg>;
  const view: HistoryView = {
    atPresent: () => atPresent,
    commit(change, move) {
      change();
      commits.push(state.window.items.length);
      moves.push(move);
    },
    nextFrame: () => Promise.resolve(),
    settled: (maxWaitMs) =>
      touching && maxWaitMs === undefined ? touching : Promise.resolve(),
    ready: () => Promise.resolve(),
    rowLimit: () => rowLimit,
  };
  const history = createHistory<Msg>({
    source: ch.source,
    view,
    isOwn: (m) => !!m.mine,
    onChange: (next) => (state = next),
    timeoutMs: options.timeoutMs ?? 1000,
  });
  return {
    ...ch,
    history,
    moves,
    commits,
    state: () => state,
    nums: () => state.window.items.map(num),
    reader: (present: boolean) => (atPresent = present),
    limit: (rows: number) => (rowLimit = rows),
    /** A finger is on the list until `lift()` */
    touch: () => {
      touching = new Promise<void>((resolve) => (liftFinger = resolve));
    },
    lift: () => {
      touching = undefined;
      liftFinger();
    },
  };
}

/** Let every pending promise step run */
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe("history: opening a channel", () => {
  it("asks once for the newest page and lands at the present", async () => {
    const t = setup(3000);
    await t.history.open();
    expect(t.calls).toEqual(["latest 30"]);
    expect(t.nums()[0]).toBe(3000);
    expect(t.state().window.atEnd).toBe(true);
    expect(t.state().pending).toBeUndefined();
    expect(t.moves.at(-1)).toEqual({ to: "present", glide: false });
  });

  it("draws the newest rows first, then the rest", async () => {
    const t = setup(3000);
    await t.history.open();
    expect(t.commits).toEqual([15, 30]);
  });

  it("opened on a message, asks once for the page around it and lands on it", async () => {
    const t = setup(3000);
    await t.history.open({ around: id(1500) });
    expect(t.calls).toEqual(["nearby 1500"]);
    expect(t.nums()).toContain(1500);
    expect(t.state().window.atEnd).toBe(false);
    expect(t.state().window.atStart).toBe(false);
    expect(t.moves.at(-1)).toEqual({
      to: "message",
      id: id(1500),
      glide: false,
    });
  });

  it("a short channel is known to be whole", async () => {
    const t = setup(12);
    await t.history.open();
    expect(t.state().window.atStart).toBe(true);
    expect(t.state().window.atEnd).toBe(true);
  });

  it("a failed first load can be tried again", async () => {
    const t = setup(100);
    t.failing(true);
    await t.history.open();
    expect(t.state().failed).toBe("initial");
    expect(t.state().pending).toBeUndefined();
    t.failing(false);
    await t.history.retry();
    expect(t.state().failed).toBeUndefined();
    expect(t.nums()[0]).toBe(100);
  });
});

describe("history: paging", () => {
  it("loads the page above the oldest row", async () => {
    const t = setup(3000);
    await t.history.open();
    await t.history.loadOlder();
    expect(t.calls).toEqual(["latest 30", "before 2971"]);
    expect(t.nums().at(-1)).toBe(2921);
    expect(t.moves.at(-1)).toEqual({ to: "keep" });
  });

  it("asks only once while a page is on its way", async () => {
    const t = setup(3000);
    await t.history.open();
    t.gate(true);
    const first = t.history.loadOlder();
    const second = t.history.loadOlder();
    t.history.loadNewer();
    await flush();
    t.release();
    await Promise.all([first, second]);
    expect(t.calls.filter((c) => c.startsWith("before"))).toHaveLength(1);
  });

  it("adds a page a few rows at a time and stays busy until it is all in", async () => {
    const t = setup(3000);
    await t.history.open();
    t.commits.length = 0;
    await t.history.loadOlder();
    expect(t.commits).toEqual([45, 60, 75, 80]);
    expect(t.state().pending).toBeUndefined();
  });

  it("stops at the first message", async () => {
    const t = setup(70);
    await t.history.open();
    await t.history.loadOlder();
    expect(t.state().window.atStart).toBe(true);
    await t.history.loadOlder();
    expect(t.calls).toEqual(["latest 30", "before 41"]);
    expect(t.nums().at(-1)).toBe(1);
  });

  it("past the display limit the newest rows go and the window is no longer live", async () => {
    const t = setup(3000);
    await t.history.open();
    for (let i = 0; i < 3; i++) await t.history.loadOlder();
    expect(t.state().window.items).toHaveLength(150);
    expect(t.state().window.atEnd).toBe(false);
    expect(t.nums()[0]).toBe(2970);
  });

  it("older rows come in while a finger is on the list; the far rows go once it is off", async () => {
    const t = setup(3000);
    await t.history.open();
    for (let i = 0; i < 2; i++) await t.history.loadOlder();
    expect(t.state().window.items).toHaveLength(130);
    t.touch();
    const page = t.history.loadOlder();
    await flush();
    // all of the page is in, nothing was dropped under the finger
    expect(t.state().window.items).toHaveLength(180);
    expect(t.state().window.atEnd).toBe(true);
    expect(t.state().pending).toBeUndefined();
    t.lift();
    await page;
    expect(t.state().window.items).toHaveLength(150);
    expect(t.state().window.atEnd).toBe(false);
    expect(t.nums()[0]).toBe(2970);
  });

  it("under a finger that never lifts the list still does not grow without end", async () => {
    const t = setup(3000);
    await t.history.open();
    t.touch();
    for (let i = 0; i < 12; i++) {
      t.history.loadOlder();
      await flush();
    }
    expect(t.state().window.items.length).toBeLessThanOrEqual(300);
    expect(t.nums().at(-1)).toBe(2371);
  });

  it("keeps as many rows as the view says it needs", async () => {
    const t = setup(3000);
    t.limit(250);
    await t.history.open();
    for (let i = 0; i < 5; i++) await t.history.loadOlder();
    expect(t.state().window.items).toHaveLength(250);
    expect(t.state().window.atEnd).toBe(false);
  });

  it("scrolling back down loads newer pages until the present", async () => {
    const t = setup(200);
    await t.history.open({ around: id(100) });
    await t.history.loadNewer();
    expect(t.calls.at(-1)).toBe("after 125");
    expect(t.state().window.atEnd).toBe(false);
    await t.history.loadNewer();
    expect(t.state().window.atEnd).toBe(true);
    expect(t.nums()[0]).toBe(200);
    await t.history.loadNewer();
    expect(t.calls.filter((c) => c.startsWith("after"))).toHaveLength(2);
  });

  it("a failed page is not asked for again until the reader says so", async () => {
    const t = setup(3000);
    await t.history.open();
    t.failing(true);
    await t.history.loadOlder();
    expect(t.state().failed).toBe("older");
    for (let i = 0; i < 50; i++) await t.history.loadOlder();
    expect(t.calls.filter((c) => c.startsWith("before"))).toHaveLength(1);
    t.failing(false);
    await t.history.retry();
    expect(t.state().failed).toBeUndefined();
    expect(t.nums().at(-1)).toBe(2921);
  });

  it("a request that never answers becomes a failure the reader can retry", async () => {
    const t = setup(3000, { timeoutMs: 20 });
    await t.history.open();
    t.hanging(true);
    await t.history.loadOlder();
    expect(t.state().failed).toBe("older");
    expect(t.state().pending).toBeUndefined();
  });
});

describe("history: jump to the present", () => {
  it("away from the present, asks once for the newest page and lands at the bottom", async () => {
    const t = setup(3000);
    await t.history.open({ around: id(100) });
    t.calls.length = 0;
    await t.history.toPresent();
    expect(t.calls).toEqual(["latest 50"]);
    expect(t.nums()[0]).toBe(3000);
    expect(t.state().window.atEnd).toBe(true);
    expect(t.moves.at(-1)).toEqual({ to: "present", glide: false });
  });

  it("in a live window, glides down without asking the server", async () => {
    const t = setup(3000);
    await t.history.open();
    t.calls.length = 0;
    await t.history.toPresent();
    expect(t.calls).toEqual([]);
    expect(t.moves.at(-1)).toEqual({ to: "present", glide: true });
  });

  it("clears the count of unseen messages", async () => {
    const t = setup(3000);
    await t.history.open();
    t.reader(false);
    t.history.received(t.add());
    expect(t.state().unseen).toBe(1);
    await t.history.toPresent();
    expect(t.state().unseen).toBe(0);
  });

  it("keeps a message that arrives while the newest page is on its way", async () => {
    const t = setup(3000);
    await t.history.open({ around: id(100) });
    t.gate(true);
    const jump = t.history.toPresent();
    await flush();
    const late = { id: id(3001) };
    t.history.received(late);
    t.release();
    await jump;
    expect(t.nums()[0]).toBe(3001);
  });

  it("wins over a page that was on its way, also when that page answers last", async () => {
    const t = setup(3000);
    await t.history.open({ around: id(100) });
    t.gate(true);
    const page = t.history.loadOlder();
    await flush();
    // the jump is answered first, the older page only afterwards
    t.gate(false);
    await t.history.toPresent();
    t.release();
    await page;
    await flush();
    expect(t.nums()[0]).toBe(3000);
    expect(t.nums()).not.toContain(60);
    expect(t.nums()).toHaveLength(50);
    expect(t.state().pending).toBeUndefined();
  });
});

describe("history: jump to a message", () => {
  it("a loaded message is shown without asking the server", async () => {
    const t = setup(3000);
    await t.history.open();
    t.calls.length = 0;
    await t.history.toMessage(id(2990));
    expect(t.calls).toEqual([]);
    expect(t.moves.at(-1)).toEqual({
      to: "message",
      id: id(2990),
      glide: true,
    });
  });

  it("the same message can be jumped to again", async () => {
    const t = setup(3000);
    await t.history.open();
    await t.history.toMessage(id(2990));
    await t.history.toMessage(id(2990));
    expect(t.moves.filter((m) => m.to === "message")).toHaveLength(2);
  });

  it("a message outside the window is loaded with its surroundings, once", async () => {
    const t = setup(3000);
    await t.history.open();
    t.calls.length = 0;
    await t.history.toMessage(id(40));
    expect(t.calls).toEqual(["nearby 40"]);
    expect(t.nums()).toContain(40);
    expect(t.state().window.atEnd).toBe(false);
    expect(t.moves.at(-1)).toEqual({ to: "message", id: id(40), glide: false });
  });

  it("a message that is already being loaded is asked for once", async () => {
    const t = setup(3000);
    t.gate(true);
    const open = t.history.open({ around: id(1500) });
    const jump = t.history.toMessage(id(1500));
    await flush();
    t.release();
    await Promise.all([open, jump]);
    expect(t.calls).toEqual(["nearby 1500"]);
    expect(t.moves.filter((m) => m.to === "message")).toHaveLength(1);
  });

  it("near the newest message the window stays live", async () => {
    const t = setup(3000);
    await t.history.open({ around: id(100) });
    await t.history.toMessage(id(2995));
    expect(t.state().window.atEnd).toBe(true);
  });

  it("an id that is not a message lands on the next message after it", async () => {
    const t = setup(3000);
    await t.history.open();
    // between 2989 and 2990
    await t.history.toMessage(`${id(2989)}5`);
    expect(t.moves.at(-1)).toEqual({
      to: "message",
      id: id(2990),
      glide: true,
    });
  });
});

describe("history: messages arriving and leaving", () => {
  it("at the present a new message joins the list and nothing is announced", async () => {
    const t = setup(100);
    await t.history.open();
    t.history.received(t.add());
    expect(t.nums()[0]).toBe(101);
    expect(t.state().unseen).toBe(0);
  });

  it("while the reader is scrolled up it joins the list and is counted", async () => {
    const t = setup(100);
    await t.history.open();
    t.reader(false);
    t.history.received(t.add());
    t.history.received(t.add());
    expect(t.nums()[0]).toBe(102);
    expect(t.state().unseen).toBe(2);
    expect(t.moves.at(-1)).toEqual({ to: "keep" });
  });

  it("the reader's own message is not counted", async () => {
    const t = setup(100);
    await t.history.open();
    t.reader(false);
    t.history.received({ ...t.add(), mine: true });
    expect(t.state().unseen).toBe(0);
  });

  it("while newer messages are not loaded it is counted but not shown", async () => {
    const t = setup(3000);
    await t.history.open({ around: id(100) });
    t.reader(false);
    const before = t.nums().length;
    t.history.received(t.add());
    expect(t.nums()).toHaveLength(before);
    expect(t.state().unseen).toBe(1);
  });

  it("the count clears when the reader is back at the present", async () => {
    const t = setup(100);
    await t.history.open();
    t.reader(false);
    t.history.received(t.add());
    t.reader(true);
    t.history.seen();
    expect(t.state().unseen).toBe(0);
  });

  it("rows are dropped from the top only while the reader is at the present", async () => {
    const t = setup(3000);
    await t.history.open();
    for (let i = 0; i < 3; i++) await t.history.loadOlder();
    await t.history.toPresent();
    for (let i = 0; i < 2; i++) await t.history.loadOlder();
    expect(t.state().window.items).toHaveLength(150);
    expect(t.state().window.atEnd).toBe(true);
    t.reader(false);
    t.history.received(t.add());
    expect(t.state().window.items).toHaveLength(151);
    t.reader(true);
    t.history.received(t.add());
    expect(t.state().window.items).toHaveLength(150);
  });

  it("deleted messages leave the list", async () => {
    const t = setup(100);
    await t.history.open();
    t.history.removed([id(99)]);
    expect(t.nums()).not.toContain(99);
  });
});

describe("history: reconnecting", () => {
  it("at the present the newest page replaces the list without emptying it first", async () => {
    const t = setup(100);
    await t.history.open();
    t.add();
    const sizes: number[] = [];
    const reload = t.history.reconnected();
    sizes.push(t.state().window.items.length);
    await reload;
    expect(sizes[0]).toBe(30);
    expect(t.nums()[0]).toBe(101);
    expect(t.state().window.atEnd).toBe(true);
  });

  it("while reading older rows nothing moves and the gap is filled by paging down", async () => {
    const t = setup(100);
    await t.history.open();
    t.reader(false);
    for (let i = 0; i < 60; i++) t.add();
    t.calls.length = 0;
    await t.history.reconnected();
    expect(t.calls).toEqual([]);
    expect(t.state().window.atEnd).toBe(false);
    await t.history.loadNewer();
    expect(t.calls).toEqual(["after 100"]);
    await t.history.loadNewer();
    expect(t.state().window.atEnd).toBe(true);
    expect(t.nums()[0]).toBe(160);
  });

  it("clears an earlier failure so loading resumes", async () => {
    const t = setup(3000);
    await t.history.open();
    t.failing(true);
    await t.history.loadOlder();
    t.failing(false);
    t.reader(false);
    await t.history.reconnected();
    expect(t.state().failed).toBeUndefined();
  });
});

describe("history: leaving and coming back", () => {
  it("a snapshot restores the same rows without asking the server", async () => {
    const t = setup(3000);
    await t.history.open({ around: id(1500) });
    const kept = t.history.snapshot();
    const again = setup(3000);
    await again.history.open({
      restore: { ...kept, mark: { id: id(1500), offset: 120 } },
    });
    expect(again.calls).toEqual([]);
    expect(again.nums()).toEqual(t.nums());
    expect(again.state().window.atEnd).toBe(false);
    expect(again.moves.at(-1)).toEqual({
      to: "mark",
      mark: { id: id(1500), offset: 120 },
    });
  });

  it("a live snapshot comes back at the present", async () => {
    const t = setup(3000);
    await t.history.open();
    const again = setup(3000);
    await again.history.open({
      restore: { ...t.history.snapshot(), mark: { id: id(2980), offset: 10 } },
    });
    expect(again.moves.at(-1)).toEqual({ to: "present", glide: false });
  });

  it("an answer that arrives after the list is gone changes nothing", async () => {
    const t = setup(3000);
    await t.history.open();
    t.gate(true);
    const page = t.history.loadOlder();
    await flush();
    const moves = t.moves.length;
    t.history.dispose();
    t.release();
    await page;
    expect(t.moves).toHaveLength(moves);
    expect(t.nums()).toHaveLength(30);
  });
});
