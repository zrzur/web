import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { FRAME_DRAWINGS, loadFrameArt, profileFrameSvg } from "./builtinFrames";
import { type ProfileFrameId, PROFILE_FRAME_IDS } from "./frameIds";
import { FRAME_FACTS, pixelSize } from "./frameRoom";

/** the frames of 2026-11-25, drawn ahead of time (pixel/set/) */
const SET = [
  "desert-lanterns",
  "damascus-jasmine",
  "autumn-maple",
  "coral-reef",
  "mushroom-forest",
  "zrzur-neon",
  "zrzur-arcade",
  "zrzur-flock",
] as const satisfies readonly ProfileFrameId[];

/**
 * The Zrzur logo, 02-laugh-B white, exactly as in the master file
 * (assets/logo/controller-app-platforms/masters/ in the brand kit): the
 * frames carry it as it is, never redrawn or recoloured
 */
const LOGO_PATH =
  '<path fill="#FFFFFF" fill-rule="evenodd" d="M 84 78 L 172 78 C 181 78 187 81 193 88 L 226 124 C 237 136 237 148 226 159 L 210 175 C 199 186 185 186 175 176 L 166 167 C 162 163 157 161 150 161 L 106 161 C 99 161 94 163 90 167 L 81 176 C 71 186 57 186 46 175 L 30 159 C 19 148 19 136 30 124 L 63 88 C 69 81 75 78 84 78 Z M 68 126 C 70 113 78 104 89 104 C 102 103 112 112 115 125 C 117 132 112 135 107 131 C 101 126 96 122 91 122 C 85 122 80 126 75 131 C 70 135 67 132 68 126 Z M 188 126 C 186 113 178 104 167 104 C 154 103 144 112 141 125 C 139 132 144 135 149 131 C 155 126 160 122 165 122 C 171 122 176 126 181 131 C 186 135 189 132 188 126 Z"/>';

/**
 * Every cell of a drawing in card coordinates: each `<g transform>` piece,
 * its paths of `M x y h w v n h -w z` runs moved and scaled.
 */
function cells(svg: string) {
  const out: [number, number, number, number][] = [];
  for (const g of svg.matchAll(
    /<g transform="translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)"( class="z-frame-twinkle")?>([\s\S]*?)<\/g>(?=<g transform|<\/g><\/svg>)/g,
  )) {
    if (g[4]) continue; // the twinkle layer
    const [tx, ty, s] = [Number(g[1]), Number(g[2]), Number(g[3])];
    for (const run of g[5].matchAll(/M(-?\d+) (-?\d+)h(\d+)v(\d+)h-\d+z/g)) {
      const [x, y, w, h] = run.slice(1, 5).map(Number);
      out.push([tx + x * s, ty + y * s, w * s, h * s]);
    }
  }
  return out;
}

describe("the frames of 2026-11-25", () => {
  it("are listed after Crystal cave", () => {
    expect([...PROFILE_FRAME_IDS]).toEqual(["crystal", ...SET]);
  });

  it("each loads on its own, never with the others or the app", () => {
    const source = readFileSync(`${__dirname}/builtinFrames.ts`, "utf8");
    expect(source).not.toMatch(/from "\.\/pixel\/set/);
    for (const id of SET) {
      const file = id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
      expect(source).toContain(`import("./pixel/set/${file}")`);
    }
    const ids = readFileSync(`${__dirname}/frameIds.ts`, "utf8");
    expect(ids).not.toMatch(/^import /m);
  });

  it("asks for the art to be loaded before it is drawn", () => {
    expect(() => profileFrameSvg("zrzur-flock", 360, 500)).toThrow(
      /loadFrameArt/,
    );
  });

  for (const id of SET) {
    it(`${id}: clean, in its room, off the content, at every size`, async () => {
      await loadFrameArt(id);
      for (const [w, h, phone] of [
        [360, 640, false],
        [458, 638, false],
        [375, 600, true],
        [200, 260, false],
      ] as const) {
        const { svg, room } = profileFrameSvg(id, w, h, { phone, prefix: "t" });
        const cell = pixelSize(w, phone);
        expect(room).toEqual({
          x: 14 * cell,
          top: 24 * cell,
          bottom: 18 * cell,
        });
        expect(FRAME_DRAWINGS[id].room(cell)).toEqual(room);
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).not.toMatch(/NaN|undefined|Infinity/);
        // nothing that runs, nothing fetched, colours from our palettes only
        expect(svg).not.toMatch(/<script|on\w+=|href=|<image|<foreignObject/i);
        for (const colour of svg.match(/fill="[^"]+"/g) ?? [])
          expect(colour).toMatch(/^fill="#[0-9A-F]{6}"$/);
        // ids are scoped, so frames on one page do not share a clip
        expect(svg).toContain('id="t-room"');
        expect(svg).toContain('clip-path="url(#t-room)"');

        const all = cells(svg);
        expect(all.length).toBeGreaterThan(300);
        let overBanner = 0;
        let elsewhere = 0;
        for (const [x, y, rw, rh] of all) {
          expect(rh).toBe(cell);
          expect(x).toBeGreaterThanOrEqual(-room.x);
          expect(x + rw).toBeLessThanOrEqual(w + room.x);
          expect(y).toBeGreaterThanOrEqual(-room.top);
          expect(y + rh).toBeLessThanOrEqual(h + room.bottom);
          const into = Math.min(x + rw, w - x, y + rh, h - y);
          // the top-start corner over the banner, clear of the avatar
          if (x < 22 * cell && y < 14 * cell)
            overBanner = Math.max(overBanner, into);
          else elsewhere = Math.max(elsewhere, into);
        }
        expect(overBanner).toBeLessThanOrEqual(5 * cell);
        expect(elsewhere).toBeLessThanOrEqual(2 * cell);
      }
    }, 30_000);
  }

  it("twinkle where they have sparkles or glows, and only there", async () => {
    for (const id of SET) {
      await loadFrameArt(id);
      const { svg } = profileFrameSvg(id, 360, 640);
      expect(svg.includes('class="z-frame-twinkle"')).toBe(
        FRAME_FACTS[id].moves,
      );
      expect(FRAME_DRAWINGS[id].moves).toBe(FRAME_FACTS[id].moves);
    }
    expect(FRAME_FACTS["autumn-maple"].moves).toBe(false);
    expect(FRAME_FACTS["zrzur-flock"].moves).toBe(false);
  }, 30_000);

  it("carry the Zrzur logo as it is, in the three Zrzur frames only", async () => {
    expect(LOGO_PATH.length).toBeGreaterThan(100);
    for (const id of SET) {
      await loadFrameArt(id);
      const { svg } = profileFrameSvg(id, 360, 640);
      expect(svg.includes(LOGO_PATH)).toBe(id.startsWith("zrzur-"));
    }
  }, 30_000);

  it("stay inside their room on a very short card, where the corners come close", async () => {
    for (const id of SET) {
      await loadFrameArt(id);
      for (const [w, h] of [
        [360, 96],
        [200, 60],
      ] as const) {
        const { svg, room } = profileFrameSvg(id, w, h, { prefix: "s" });
        // whatever reaches past the room is cut at its edge
        expect(svg).toContain(
          `<rect x="${-room.x}" y="${-room.top}" width="${w + 2 * room.x}" height="${h + room.top + room.bottom}"/>`,
        );
        expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  }, 30_000);
});
