import { describe, expect, it } from "vitest";

import {
  isAtPresent,
  jumpBar,
  rowsToKeep,
  scrollTopToShowRow,
  travel,
  wantedPage,
} from "./reader";

describe("reader: at the present", () => {
  it("is at the present at the bottom of a live window", () => {
    expect(isAtPresent({ atEnd: true, below: 0 })).toBe(true);
  });

  it("allows a few pixels of slack (sub-pixel scroll positions)", () => {
    expect(isAtPresent({ atEnd: true, below: 24 })).toBe(true);
  });

  it("is not at the present once scrolled up", () => {
    expect(isAtPresent({ atEnd: true, below: 200 })).toBe(false);
  });

  it("is never at the present while newer messages are not loaded", () => {
    expect(isAtPresent({ atEnd: false, below: 0 })).toBe(false);
  });
});

describe("reader: which page to ask for", () => {
  const base = {
    atStart: false,
    atEnd: true,
    busy: false,
    failed: undefined,
    above: 5000,
    below: 0,
    viewport: 800,
    empty: false,
  } as const;

  it("asks for nothing while plenty of rows are loaded on both sides", () => {
    expect(wantedPage({ ...base, atEnd: false, below: 5000 })).toBeUndefined();
  });

  it("asks for older rows well before the reader reaches the top", () => {
    expect(wantedPage({ ...base, above: 1500 })).toBe("older");
  });

  it("asks for older rows when the loaded ones do not fill the view", () => {
    expect(wantedPage({ ...base, above: 0 })).toBe("older");
  });

  it("does not ask past the first message", () => {
    expect(wantedPage({ ...base, atStart: true, above: 0 })).toBeUndefined();
  });

  it("asks for newer rows well before the reader reaches the bottom", () => {
    expect(wantedPage({ ...base, atEnd: false, below: 900 })).toBe("newer");
  });

  it("does not ask past the present", () => {
    expect(wantedPage({ ...base, atEnd: true, below: 0 })).toBeUndefined();
  });

  it("serves the nearer edge first when both are close", () => {
    const both = { ...base, atEnd: false };
    expect(wantedPage({ ...both, above: 100, below: 600 })).toBe("older");
    expect(wantedPage({ ...both, above: 600, below: 100 })).toBe("newer");
  });

  it("asks for nothing while a request is running", () => {
    expect(wantedPage({ ...base, above: 0, busy: true })).toBeUndefined();
  });

  it("does not ask again by itself for a side that just failed", () => {
    expect(wantedPage({ ...base, above: 0, failed: "older" })).toBeUndefined();
  });

  it("a failure on one side does not stop the other", () => {
    expect(
      wantedPage({
        ...base,
        atEnd: false,
        above: 5000,
        below: 0,
        failed: "older",
      }),
    ).toBe("newer");
  });

  it("asks for nothing before the first page is in", () => {
    expect(wantedPage({ ...base, above: 0, empty: true })).toBeUndefined();
  });
});

describe("reader: the jump bar", () => {
  const base = {
    atEnd: true,
    below: 0,
    viewport: 800,
    unseen: 0,
    newestVisible: true,
  };
  const away = { ...base, newestVisible: false };

  it("is hidden at the present", () => {
    expect(jumpBar(base)).toBeUndefined();
  });

  it("is hidden after a short scroll up", () => {
    expect(jumpBar({ ...away, below: 300 })).toBeUndefined();
  });

  it("shows once the reader is more than a screen away from the bottom", () => {
    expect(jumpBar({ ...away, below: 900 })).toEqual({
      kind: "older",
      unseen: 0,
    });
  });

  it("shows whenever newer messages are not loaded", () => {
    expect(jumpBar({ ...away, atEnd: false, below: 0 })).toEqual({
      kind: "older",
      unseen: 0,
    });
  });

  it("announces messages that arrived while the reader was away, even close to the bottom", () => {
    expect(jumpBar({ ...away, below: 300, unseen: 3 })).toEqual({
      kind: "new",
      unseen: 3,
    });
  });

  it("never announces at the present", () => {
    expect(jumpBar({ ...base, below: 0, unseen: 3 })).toBeUndefined();
  });

  it("never lies over the newest message: hidden while that message is on screen", () => {
    // a tall newest message, partly in view, and the reader not at the bottom
    expect(
      jumpBar({ ...base, below: 200, unseen: 2, newestVisible: true }),
    ).toBeUndefined();
    expect(
      jumpBar({ ...base, below: 1200, newestVisible: true }),
    ).toBeUndefined();
  });
});

describe("reader: moving the view", () => {
  it("glides over a short distance and cuts over a long one", () => {
    expect(travel(600, 800, false)).toBe("smooth");
    expect(travel(8000, 800, false)).toBe("instant");
  });

  it("never glides when motion is reduced", () => {
    expect(travel(600, 800, true)).toBe("instant");
  });

  // scrollTop of a column-reverse list: 0 at the bottom, negative above it
  const view = { scrollTop: -3000, viewport: 800, scrollHeight: 10000 };

  it("puts a row in the middle of the view", () => {
    // the row is 100 px tall and 1000 px above the top edge of the view
    const top = scrollTopToShowRow({ ...view, rowTop: -1000, rowHeight: 100 });
    // afterwards its middle sits at 400 px: it moved down by 1350 px
    expect(top).toBe(-4350);
  });

  it("shows the start of a row taller than the view", () => {
    const top = scrollTopToShowRow({ ...view, rowTop: 300, rowHeight: 2000 });
    // its top lands a little below the top edge
    expect(top).toBe(-3000 + 300 - 16);
  });

  it("does not scroll past the bottom", () => {
    expect(
      scrollTopToShowRow({
        ...view,
        scrollTop: -100,
        rowTop: 700,
        rowHeight: 60,
      }),
    ).toBe(0);
  });

  it("does not scroll past the top", () => {
    expect(
      scrollTopToShowRow({
        ...view,
        scrollTop: -9000,
        rowTop: -150,
        rowHeight: 60,
      }),
    ).toBe(-9200);
  });
});

describe("reader: how many rows to keep", () => {
  it("keeps the usual 150 where rows are tall for the screen", () => {
    // rows of 100 px (wrapped text on a phone) in a 640 px view
    expect(rowsToKeep({ viewport: 640, rowsHeight: 15000, count: 150 })).toBe(
      150,
    );
  });

  it("keeps five screens of rows and two pages on a desktop", () => {
    // rows of 40 px in an 800 px view: 100 rows are five screens
    expect(rowsToKeep({ viewport: 800, rowsHeight: 6000, count: 150 })).toBe(
      200,
    );
  });

  it("keeps more on a tall screen with short rows", () => {
    // 1400 px view, rows of 26 px: five screens of rows are 270 rows, plus two pages
    const keep = rowsToKeep({ viewport: 1400, rowsHeight: 3900, count: 150 });
    expect(keep).toBe(370);
  });

  it("always covers two screens on each side of the view plus two pages", () => {
    for (const [viewport, row] of [
      [600, 30],
      [900, 24],
      [1400, 26],
      [2000, 60],
    ]) {
      const keep = rowsToKeep({ viewport, rowsHeight: row * 150, count: 150 });
      expect((keep - 100) * row).toBeGreaterThanOrEqual(viewport * 5);
    }
  });

  it("keeps the usual number before anything is measured", () => {
    expect(rowsToKeep({ viewport: 0, rowsHeight: 0, count: 0 })).toBe(150);
  });
});
