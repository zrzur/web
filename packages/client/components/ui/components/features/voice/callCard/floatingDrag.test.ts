// Bug #9 (owner, 2026-11-22): the floating call card sat low on the screen,
// partly under the phone browser's bar. Corners are worked out from the
// visible viewport and always keep the whole card on screen.
import { describe, expect, it } from "vitest";

import {
  BOTTOM_GAP,
  EDGE_GAP,
  TOP_GAP,
  clampToViewport,
  cornerAfterKey,
  cornerPosition,
  isCorner,
  movedPastThreshold,
  nearestCorner,
} from "./floatingDrag";

const card = { width: 300, height: 170 };
const phone = { width: 375, height: 667 };
const desktop = { width: 1366, height: 860 };

const inside = (
  p: { x: number; y: number },
  size: typeof card,
  view: typeof phone,
) =>
  p.x >= 0 &&
  p.y >= 0 &&
  p.x + size.width <= view.width &&
  p.y + size.height <= view.height;

describe("corners", () => {
  it("are clear of the header, the composer and the edges", () => {
    expect(cornerPosition("tl", card, desktop)).toEqual({ x: EDGE_GAP, y: TOP_GAP });
    expect(cornerPosition("br", card, desktop)).toEqual({
      x: desktop.width - EDGE_GAP - card.width,
      y: desktop.height - BOTTOM_GAP - card.height,
    });
  });

  it("keep the whole card on a phone, in every corner", () => {
    for (const corner of ["tl", "tr", "bl", "br"] as const)
      expect(inside(cornerPosition(corner, card, phone), card, phone)).toBe(true);
  });

  it("stay inside the safe area (notch, home bar)", () => {
    const insets = { top: 47, right: 0, bottom: 34, left: 0 };
    const top = cornerPosition("tr", card, phone, insets);
    const bottom = cornerPosition("br", card, phone, insets);
    expect(top.y).toBe(47 + TOP_GAP);
    expect(bottom.y + card.height).toBe(phone.height - 34 - BOTTOM_GAP);
  });

  it("never leave the screen on a very small window", () => {
    const tiny = { width: 280, height: 200 };
    for (const corner of ["tl", "tr", "bl", "br"] as const) {
      const p = cornerPosition(corner, card, tiny);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("a drop", () => {
  it("goes to the nearest corner", () => {
    expect(nearestCorner({ x: 10, y: 10 }, card, desktop)).toBe("tl");
    expect(nearestCorner({ x: 1000, y: 10 }, card, desktop)).toBe("tr");
    expect(nearestCorner({ x: 10, y: 600 }, card, desktop)).toBe("bl");
    expect(nearestCorner({ x: 1000, y: 600 }, card, desktop)).toBe("br");
  });

  it("past the edge is pulled back on screen while dragging", () => {
    expect(clampToViewport({ x: -80, y: 900 }, card, desktop)).toEqual({
      x: 0,
      y: desktop.height - card.height,
    });
  });
});

describe("tap or drag", () => {
  it("is a drag only past the threshold", () => {
    expect(movedPastThreshold({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(movedPastThreshold({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true);
  });

  it("only known corners are taken from storage", () => {
    expect(isCorner("br")).toBe(true);
    expect(isCorner("middle")).toBe(false);
    expect(isCorner(null)).toBe(false);
  });
});

describe("an on-screen keyboard", () => {
  it("never covers a card in a bottom corner", () => {
    // iOS: the layout viewport stays 812 high, what is visible shrinks
    const keyboard = { top: 0, height: 420 };
    const p = cornerPosition("br", card, { width: 375, height: 812 }, undefined, keyboard);
    expect(p.y + card.height).toBe(420 - BOTTOM_GAP);
  });

  it("leaves a top corner where it is", () => {
    const p = cornerPosition("tl", card, { width: 375, height: 812 }, undefined, { top: 0, height: 420 });
    expect(p.y).toBe(TOP_GAP);
  });

  it("follows the visible part when the page is scrolled under the keyboard", () => {
    const p = cornerPosition("bl", card, { width: 375, height: 812 }, undefined, { top: 100, height: 420 });
    expect(p.y + card.height).toBe(520 - BOTTOM_GAP);
  });
});

describe("arrow keys", () => {
  it("move the card between corners", () => {
    expect(cornerAfterKey("tr", "ArrowDown")).toBe("br");
    expect(cornerAfterKey("br", "ArrowLeft")).toBe("bl");
    expect(cornerAfterKey("bl", "ArrowUp")).toBe("tl");
    expect(cornerAfterKey("tl", "ArrowRight")).toBe("tr");
  });

  it("do nothing at the edge or for other keys", () => {
    expect(cornerAfterKey("tr", "ArrowUp")).toBeUndefined();
    expect(cornerAfterKey("tr", "ArrowRight")).toBeUndefined();
    expect(cornerAfterKey("tr", "Enter")).toBeUndefined();
  });
});
