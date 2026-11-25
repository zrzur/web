import { describe, expect, it } from "vitest";

import { userStyleOf } from "../userStyle";
import { sendableStyle } from "../userStyleExtras";

import { FRAME_DRAWINGS, profileFrameSvg } from "./builtinFrames";
import { FRAME_TEMPLATE, frameBorderImage, frameRise } from "./communityFrame";
import { PROFILE_FRAME_IDS, isProfileFrameId } from "./frameIds";
import { FRAME_FACTS, pixelSize } from "./frameRoom";
import { CRYSTAL_ROOM } from "./pixel/crystalCave";

/** what the backend accepts (USER_STYLE_PROFILE_FRAMES in users.rs) */
const SERVER_IDS = [
  "crystal",
  "desert-lanterns",
  "damascus-jasmine",
  "autumn-maple",
  "coral-reef",
  "mushroom-forest",
  "zrzur-neon",
  "zrzur-arcade",
  "zrzur-flock",
];

/** every rect of a drawing, in card coordinates */
const rects = (svg: string) =>
  [
    ...svg.matchAll(
      /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
    ),
  ].map((m) => m.slice(1, 5).map(Number) as [number, number, number, number]);

describe("built-in profile frames", () => {
  it("are the ids the server accepts", () => {
    expect([...PROFILE_FRAME_IDS]).toEqual(SERVER_IDS);
    expect(isProfileFrameId("crystal")).toBe(true);
    expect(isProfileFrameId("mihrab")).toBe(false);
    expect(isProfileFrameId(undefined)).toBe(false);
  });

  it("know their room without the drawing, the same as the drawing's", () => {
    expect(FRAME_FACTS.crystal.room).toEqual({ ...CRYSTAL_ROOM });
    const { room } = profileFrameSvg("crystal", 360, 500);
    expect(FRAME_DRAWINGS.crystal.room(4)).toEqual(room);
  });

  it("keep the ids free of any drawing", async () => {
    const { readFileSync } = await import("node:fs");
    const ids = readFileSync(`${__dirname}/frameIds.ts`, "utf8");
    expect(ids).not.toMatch(/^import /m);
    const style = readFileSync(`${__dirname}/../userStyle.ts`, "utf8");
    expect(style).not.toContain("builtinFrames");
    expect(style).not.toContain("pixel/");
  });

  it("use 4 px pixels on a card, 3 on a phone, less on small previews", () => {
    expect(pixelSize(360)).toBe(4);
    expect(pixelSize(460)).toBe(4);
    expect(pixelSize(375, true)).toBe(3);
    expect(pixelSize(240)).toBe(3);
    expect(pixelSize(150)).toBe(2);
  });

  for (const [w, h, phone] of [
    [360, 640, false],
    [458, 638, false],
    [375, 600, true],
    [200, 260, false],
  ] as const) {
    it(`crystal at ${w}x${h}${phone ? " (phone)" : ""}: clean, in its room, off the content`, () => {
      const { svg, room } = profileFrameSvg("crystal", w, h, {
        phone,
        prefix: "t",
      });
      const cell = pixelSize(w, phone);
      expect(room).toEqual({
        x: CRYSTAL_ROOM.x * cell,
        top: CRYSTAL_ROOM.top * cell,
        bottom: CRYSTAL_ROOM.bottom * cell,
      });
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      // nothing that runs, nothing fetched, colours from our palettes only
      expect(svg).not.toMatch(/<script|on\w+=|href=|<image|<foreignObject/i);
      for (const colour of svg.match(/fill="[^"]+"/g) ?? [])
        expect(colour).toMatch(/^fill="#[0-9A-F]{6}"$/);
      // the pixel art (the sparkles after it are drawn as small crosses)
      const all = rects(svg.split('<g class="z-frame-twinkle"')[0]);
      expect(all.length).toBeGreaterThan(200);
      let overBanner = 0;
      let elsewhere = 0;
      for (const [x, y, rw, rh] of all) {
        // on the pixel grid, inside the room
        expect(rh).toBe(cell);
        expect(x).toBeGreaterThanOrEqual(-room.x);
        expect(x + rw).toBeLessThanOrEqual(w + room.x + cell);
        expect(y).toBeGreaterThanOrEqual(-room.top);
        expect(y + rh).toBeLessThanOrEqual(h + room.bottom + cell);
        // how far it reaches into the card from the nearest edge
        const into = Math.min(x + rw, w - x, y + rh, h - y);
        if (y < 2 * cell) overBanner = Math.max(overBanner, into);
        else elsewhere = Math.max(elsewhere, into);
      }
      // two pixels in at most along the top, over the banner, and nowhere
      // else (one pixel of slack for the rounding of the card's size)
      expect(overBanner).toBeLessThanOrEqual(3 * cell);
      expect(elsewhere).toBeLessThanOrEqual(cell);
    });
  }

  it("twinkles, and two frames on a page keep their own ids", () => {
    const { svg } = profileFrameSvg("crystal", 360, 500, { prefix: "a" });
    expect(svg).toContain('class="z-frame-twinkle"');
    expect(FRAME_DRAWINGS.crystal.moves).toBe(true);
  });

  it("is the same drawing at every size: only the pixel size changes", () => {
    const count = (w: number, h: number) =>
      rects(profileFrameSvg("crystal", w, h).svg).length;
    const card = count(360, 640);
    const full = count(458, 638);
    expect(Math.abs(card - full) / card).toBeLessThan(0.35);
  });
});

describe("community frames", () => {
  it("lay the template over the card at its width", () => {
    const style = frameBorderImage("https://cdn.example/f.png", 340);
    expect(style["border-image-slice"]).toBe("220 80 100 80");
    expect(style["border-image-outset"]).toBe("70px 30px 40px 30px");
    expect(style["border-image-width"]).toBe("110px 40px 50px 40px");
    const big = frameBorderImage("https://cdn.example/f.png", 460);
    expect(big["border-image-outset"]).toBe("94.71px 40.59px 54.12px 40.59px");
    expect(frameRise(340)).toBe(FRAME_TEMPLATE.card.top);
  });
});

describe("profile_frame in the style", () => {
  it("drops a frame we no longer ship and keeps a creator's", () => {
    expect(userStyleOf({ style: { profile_frame: "mihrab" } })).toEqual({});
    expect(userStyleOf({ style: { profile_frame: "crystal" } })).toEqual({
      profile_frame: "crystal",
    });
    expect(
      userStyleOf({ style: { profile_frame: "c:01M5TGZFE80SKMC8JVGJKBHS2A" } }),
    ).toEqual({ profile_frame: "c:01M5TGZFE80SKMC8JVGJKBHS2A" });
  });

  it("is sent with the rest of the style, without the server's file", () => {
    expect(
      sendableStyle({
        nameplate: "aurora",
        profile_frame: "c:01M5TGZFE80SKMC8JVGJKBHS2A",
        profile_frame_file: "abc",
      }),
    ).toEqual({
      nameplate: "aurora",
      profile_frame: "c:01M5TGZFE80SKMC8JVGJKBHS2A",
    });
    expect(
      sendableStyle({ profile_frame: "crystal", theme: ["#112233"] }),
    ).toEqual({ theme: ["#112233"], profile_frame: "crystal" });
  });
});
