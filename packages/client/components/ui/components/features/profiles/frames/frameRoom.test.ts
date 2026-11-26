import { describe, expect, it } from "vitest";

import { FRAME_EDGE, framePadding, frameRoomOf } from "./frameRoom";

describe("the room a profile frame takes", () => {
  it("is the community template's, scaled with the card", () => {
    // 30 px at the sides, 70 above and 40 below a 340 px card
    expect(frameRoomOf("c:01M5TGZFE80SKMC8JVGJKBHS2A", 340)).toEqual({
      x: 30,
      top: 70,
      bottom: 40,
    });
    expect(frameRoomOf("c:01M5TGZFE80SKMC8JVGJKBHS2A", 680)).toEqual({
      x: 60,
      top: 140,
      bottom: 80,
    });
  });

  it("is none without a frame, or for a built-in one no longer shipped", () => {
    for (const frame of [undefined, "", "crystal", "zrzur-neon", "coral-reef"])
      expect(frameRoomOf(frame, 360)).toEqual({ x: 0, top: 0, bottom: 0 });
  });

  it("keeps a popup's frame whole on screen", () => {
    const room = frameRoomOf("c:01M5TGZFE80SKMC8JVGJKBHS2A", 360);
    expect(framePadding(room)).toEqual({
      top: room.top + FRAME_EDGE,
      bottom: room.bottom + FRAME_EDGE,
      left: room.x + FRAME_EDGE,
      right: room.x + FRAME_EDGE,
    });
    expect(framePadding({ x: 0, top: 0, bottom: 0 })).toEqual({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    });
  });
});
