import { describe, expect, it } from "vitest";

import {
  FRAME_EDGE,
  fitCell,
  framePadding,
  frameRoomOf,
  pixelSize,
} from "./frameRoom";
import { CRYSTAL_ROOM } from "./pixel/crystalCave";

/** card width and the most it is shown at (UserCard) */
const CARD = { w: 360, h: 640 };
/** full profile width and the most it is shown at (UserProfile) */
const FULL = { w: 460, h: 760 };

describe("a framed profile fits the window", () => {
  it("draws smaller whole pixels on shorter windows", () => {
    expect(fitCell(360, { windowHeight: 1200 })).toBe(4);
    expect(fitCell(360, { windowHeight: 1080 })).toBe(4);
    expect(fitCell(360, { windowHeight: 1000 })).toBe(3);
    expect(fitCell(460, { windowHeight: 800 })).toBe(3);
    expect(fitCell(460, { windowHeight: 700 })).toBe(3);
    expect(fitCell(460, { windowHeight: 600 })).toBe(2);
    expect(fitCell(375, { phone: true, windowHeight: 812 })).toBe(2);
    // never larger than the box's own size, and whole pixels only
    expect(fitCell(150, { windowHeight: 2000 })).toBe(pixelSize(150));
    for (const h of [500, 700, 800, 1000, 1200])
      expect(Number.isInteger(fitCell(360, { windowHeight: h }))).toBe(true);
  });

  it("knows the room of built-in, community and no frame", () => {
    expect(frameRoomOf("crystal", 360, 3)).toEqual({
      x: CRYSTAL_ROOM.x * 3,
      top: CRYSTAL_ROOM.top * 3,
      bottom: CRYSTAL_ROOM.bottom * 3,
    });
    expect(frameRoomOf("c:abc", 340, 4)).toEqual({
      x: 30,
      top: 70,
      bottom: 40,
    });
    expect(frameRoomOf(undefined, 360, 4)).toEqual({ x: 0, top: 0, bottom: 0 });
  });

  it("keeps popups 12 px clear of the edge plus the frame's room", () => {
    expect(framePadding({ x: 0, top: 0, bottom: 0 })).toEqual({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    });
    const room = frameRoomOf("crystal", 360, 3);
    expect(framePadding(room)).toEqual({
      top: room.top + FRAME_EDGE,
      bottom: room.bottom + FRAME_EDGE,
      left: room.x + FRAME_EDGE,
      right: room.x + FRAME_EDGE,
    });
  });

  // the same sums as the styles: UserCard's max height and the full
  // profile's, centred in the window
  for (const tall of [700, 800, 1000, 1200]) {
    it(`card and full profile with Crystal cave fit a ${tall} px window`, () => {
      const card = frameRoomOf(
        "crystal",
        CARD.w,
        fitCell(CARD.w, { windowHeight: tall }),
      );
      const cardH = Math.min(
        CARD.h,
        tall - card.top - card.bottom - 2 * FRAME_EDGE,
      );
      expect(cardH).toBeGreaterThan(400);
      expect(
        card.top + cardH + card.bottom + 2 * FRAME_EDGE,
      ).toBeLessThanOrEqual(tall);

      const full = frameRoomOf(
        "crystal",
        FULL.w,
        fitCell(FULL.w, { windowHeight: tall }),
      );
      const most = Math.max(full.top, full.bottom);
      const fullH = Math.min(FULL.h, 640, tall - 2 * most - 2 * FRAME_EDGE);
      expect(fullH).toBeGreaterThan(400);
      const top = (tall - fullH) / 2;
      expect(top - full.top).toBeGreaterThanOrEqual(FRAME_EDGE);
      expect(top + fullH + full.bottom).toBeLessThanOrEqual(tall - FRAME_EDGE);
    });
  }

  it("fits a 375 px phone side to side", () => {
    const room = frameRoomOf("crystal", 375, fitCell(375, { phone: true }));
    const width = 375 - 2 * (room.x + FRAME_EDGE);
    expect(width).toBeGreaterThanOrEqual(290);
  });
});
