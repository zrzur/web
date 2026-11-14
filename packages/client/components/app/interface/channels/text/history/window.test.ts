import { describe, expect, it } from "vitest";

import {
  addLive,
  addNewer,
  addOlder,
  dropNewest,
  dropOldest,
  emptyWindow,
  fromLatest,
  fromNearby,
  markStale,
  nearestId,
  removeIds,
  trimForCache,
} from "./window";

/** Messages 1..n as ULID-like ids that sort by number */
const m = (n: number) => ({ id: `M${String(n).padStart(5, "0")}` });
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => m(from + i));
const nums = (w: { items: { id: string }[] }) =>
  w.items.map((x) => Number(x.id.slice(1)));

describe("history window: first load", () => {
  it("is empty and live before anything loads", () => {
    expect(emptyWindow()).toEqual({ items: [], atStart: false, atEnd: true });
  });

  it("holds the newest page, newest first", () => {
    const w = fromLatest(range(71, 100), 30);
    expect(nums(w)[0]).toBe(100);
    expect(nums(w).at(-1)).toBe(71);
    expect(w.atEnd).toBe(true);
    expect(w.atStart).toBe(false);
  });

  it("knows the whole channel is loaded when the page is short", () => {
    const w = fromLatest(range(1, 12), 30);
    expect(w.atStart).toBe(true);
    expect(w.atEnd).toBe(true);
  });

  it("an empty channel is at its start and its end", () => {
    expect(fromLatest([], 30)).toEqual({
      items: [],
      atStart: true,
      atEnd: true,
    });
  });
});

describe("history window: around a message", () => {
  // the server answers up to limit/2+1 messages at or after the target and
  // limit/2+1 before it, in two runs that are not sorted together
  const around = (target: number, total: number, limit = 50) => {
    const half = Math.floor(limit / 2) + 1;
    const newer = range(target, Math.min(total, target + half - 1));
    const older = range(Math.max(1, target - half), target - 1).reverse();
    return [...newer, ...older];
  };

  it("sorts the two runs into one newest-first list", () => {
    const w = fromNearby(around(500, 3000), m(500).id, 50);
    const n = nums(w);
    expect(n).toEqual([...n].sort((a, b) => b - a));
    expect(n).toContain(500);
  });

  it("deep in history neither end is loaded", () => {
    const w = fromNearby(around(500, 3000), m(500).id, 50);
    expect(w.atStart).toBe(false);
    expect(w.atEnd).toBe(false);
  });

  it("near the newest message the window is live", () => {
    const w = fromNearby(around(2995, 3000), m(2995).id, 50);
    expect(w.atEnd).toBe(true);
    expect(w.atStart).toBe(false);
  });

  it("near the first message the start is known", () => {
    const w = fromNearby(around(4, 3000), m(4).id, 50);
    expect(w.atStart).toBe(true);
    expect(w.atEnd).toBe(false);
  });

  it("a full half on the newer side is not taken for the end", () => {
    // exactly limit/2+1 newer messages exist: there may be more
    const w = fromNearby(around(2975, 3000), m(2975).id, 50);
    expect(w.atEnd).toBe(false);
  });

  it("works when the target itself no longer exists", () => {
    // the server then answers the 26 messages after it and the 26 before it
    const page = [...range(501, 526), ...range(474, 499).reverse()];
    const w = fromNearby(page, m(500).id, 50);
    expect(w.items).toHaveLength(52);
    expect(w.atEnd).toBe(false);
    expect(w.atStart).toBe(false);
  });
});

describe("history window: older pages", () => {
  it("adds the page above without duplicates", () => {
    const w = addOlder(fromLatest(range(71, 100), 30), range(21, 72), 50, 150);
    expect(nums(w.window)).toEqual(
      range(21, 100)
        .map((x) => Number(x.id.slice(1)))
        .reverse(),
    );
    expect(w.window.atStart).toBe(false);
    expect(w.window.atEnd).toBe(true);
    expect(w.dropped).toBe(0);
  });

  it("a short page means the first message is reached", () => {
    const w = addOlder(fromLatest(range(11, 40), 30), range(1, 10), 50, 150);
    expect(w.window.atStart).toBe(true);
    expect(nums(w.window).at(-1)).toBe(1);
  });

  it("an empty page means the first message is reached", () => {
    const w = addOlder(fromLatest(range(1, 30), 30), [], 50, 150);
    expect(w.window.atStart).toBe(true);
    expect(w.window.items).toHaveLength(30);
  });

  it("drops the newest rows past the display limit and is no longer live", () => {
    const start = fromLatest(range(151, 300), 150);
    const w = addOlder(start, range(101, 150), 50, 150);
    expect(w.window.items).toHaveLength(150);
    expect(nums(w.window)[0]).toBe(250);
    expect(nums(w.window).at(-1)).toBe(101);
    expect(w.window.atEnd).toBe(false);
    expect(w.dropped).toBe(50);
  });

  it("stays not live once it has left the present", () => {
    const away = { ...fromLatest(range(151, 250), 100), atEnd: false };
    expect(addOlder(away, range(101, 150), 50, 150).window.atEnd).toBe(false);
  });
});

describe("history window: newer pages", () => {
  const away = {
    items: range(101, 200).reverse(),
    atStart: false,
    atEnd: false,
  };

  it("adds the page below", () => {
    const w = addNewer(away, range(201, 250), 50, 150);
    expect(nums(w.window)[0]).toBe(250);
    expect(w.window.atEnd).toBe(false);
    expect(w.dropped).toBe(0);
  });

  it("a short page means the present is reached", () => {
    const w = addNewer(away, range(201, 220), 50, 150);
    expect(w.window.atEnd).toBe(true);
    expect(nums(w.window)[0]).toBe(220);
  });

  it("an empty page means the present is reached", () => {
    expect(addNewer(away, [], 50, 150).window.atEnd).toBe(true);
  });

  it("drops the oldest rows past the display limit and forgets the start", () => {
    const full = {
      items: range(1, 150).reverse(),
      atStart: true,
      atEnd: false,
    };
    const w = addNewer(full, range(151, 200), 50, 150);
    expect(w.window.items).toHaveLength(150);
    expect(nums(w.window).at(-1)).toBe(51);
    expect(w.window.atStart).toBe(false);
    expect(w.dropped).toBe(50);
  });

  it("takes the page in either order", () => {
    const w = addNewer(away, range(201, 250).reverse(), 50, 150);
    expect(nums(w.window).slice(0, 3)).toEqual([250, 249, 248]);
  });
});

describe("history window: a message arrives", () => {
  const live = fromLatest(range(71, 100), 30);

  it("is added at the end of a live window", () => {
    const w = addLive(live, m(101), { trim: true, limit: 150 });
    expect(nums(w)[0]).toBe(101);
    expect(w.items).toHaveLength(31);
  });

  it("is not added while the window is away from the present", () => {
    const away = { ...live, atEnd: false };
    expect(addLive(away, m(101), { trim: true, limit: 150 })).toBe(away);
  });

  it("is not added twice", () => {
    const once = addLive(live, m(101), { trim: true, limit: 150 });
    expect(
      addLive(once, m(101), { trim: true, limit: 150 }).items,
    ).toHaveLength(31);
  });

  it("lands in order when it is older than the newest row", () => {
    const w = addLive(fromLatest([m(10), m(12)], 30), m(11), {
      trim: true,
      limit: 150,
    });
    expect(nums(w)).toEqual([12, 11, 10]);
  });

  it("drops the oldest row past the limit while the reader is at the bottom", () => {
    const full = { items: range(1, 150).reverse(), atStart: true, atEnd: true };
    const w = addLive(full, m(151), { trim: true, limit: 150 });
    expect(w.items).toHaveLength(150);
    expect(nums(w).at(-1)).toBe(2);
    expect(w.atStart).toBe(false);
  });

  it("drops nothing while the reader is reading older rows", () => {
    const full = { items: range(1, 150).reverse(), atStart: true, atEnd: true };
    const w = addLive(full, m(151), { trim: false, limit: 150 });
    expect(w.items).toHaveLength(151);
    expect(w.atStart).toBe(true);
  });
});

describe("history window: removals, reconnects, cache", () => {
  it("removes deleted messages", () => {
    const w = removeIds(fromLatest(range(1, 10), 30), [m(3).id, m(4).id]);
    expect(nums(w)).toEqual([10, 9, 8, 7, 6, 5, 2, 1]);
  });

  it("keeps the same window when nothing matches", () => {
    const w = fromLatest(range(1, 10), 30);
    expect(removeIds(w, ["nope"])).toBe(w);
  });

  it("after a reconnect the newer side has to be asked for again", () => {
    const w = markStale(fromLatest(range(71, 100), 30));
    expect(w.atEnd).toBe(false);
    expect(w.items).toHaveLength(30);
  });

  it("an empty window stays live after a reconnect", () => {
    expect(markStale(emptyWindow()).atEnd).toBe(true);
  });

  it("a cached window cut to its newest rows forgets the start", () => {
    const whole = {
      items: range(1, 120).reverse(),
      atStart: true,
      atEnd: true,
    };
    const w = trimForCache(whole, 50);
    expect(w.items).toHaveLength(50);
    expect(nums(w)[0]).toBe(120);
    expect(w.atStart).toBe(false);
  });

  it("a cached window that fits keeps its start", () => {
    const whole = { items: range(1, 20).reverse(), atStart: true, atEnd: true };
    expect(trimForCache(whole, 50)).toBe(whole);
  });
});

describe("history window: where a jump lands", () => {
  const items = [m(10), m(8), m(6)];

  it("on the message itself", () => {
    expect(nearestId(items, m(8).id)).toBe(m(8).id);
  });

  it("on the first message after an id that is not loaded", () => {
    expect(nearestId(items, m(7).id)).toBe(m(8).id);
  });

  it("on the newest message when nothing follows the id", () => {
    expect(nearestId(items, m(11).id)).toBe(m(10).id);
  });

  it("nowhere in an empty list", () => {
    expect(nearestId([], m(1).id)).toBeUndefined();
  });
});

describe("history window: dropping rows past the limit", () => {
  const whole = { items: range(1, 200).reverse(), atStart: true, atEnd: true };

  it("drops the newest rows and is no longer live", () => {
    const w = dropNewest(whole, 150);
    expect(w.items).toHaveLength(150);
    expect(nums(w)[0]).toBe(150);
    expect(w.atEnd).toBe(false);
    expect(w.atStart).toBe(true);
  });

  it("drops the oldest rows and forgets the start", () => {
    const w = dropOldest(whole, 150);
    expect(w.items).toHaveLength(150);
    expect(nums(w).at(-1)).toBe(51);
    expect(w.atStart).toBe(false);
    expect(w.atEnd).toBe(true);
  });

  it("leaves a window within the limit as it is", () => {
    expect(dropNewest(whole, 200)).toBe(whole);
    expect(dropOldest(whole, 500)).toBe(whole);
  });
});
