import { describe, expect, it } from "vitest";

import {
  FRAME_ALPHA_LIMIT,
  FRAME_FILE,
  FRAME_TEMPLATE,
} from "../../../../../../ui/components/features/profiles/frames/communityFrame";
import {
  artFit,
  checkCommunityFile,
  effectProblem,
  kindOf,
} from "../communityApi";

import { fileChecks, fileRefused } from "./fileCheck";
import {
  FRAME_MAX_FRAMES,
  frameCover,
  frameCoverOfFrames,
  isFrameSize,
} from "./frameCheck";
import { STUDIO_SPECS } from "./studioModel";

const W = FRAME_FILE.width;
const H = FRAME_FILE.height;

/** a clear file of the frame's size with these file-pixel boxes filled */
function file(...boxes: [number, number, number, number, number?][]) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (const [left, top, right, bottom, alpha = 255] of boxes)
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++) data[(y * W + x) * 4 + 3] = alpha;
  return data;
}

const facts = (width = W, height = H) => ({
  name: "frame.png",
  type: "image/png",
  bytes: 1000,
  width,
  height,
  animated: false,
});

describe("the frame template matches the backend", () => {
  it("is 800 x 1020 px, twice the 400 x 510 template", () => {
    expect(FRAME_FILE).toEqual({ width: 800, height: 1020 });
    expect(FRAME_TEMPLATE.card).toEqual({
      left: 30,
      top: 70,
      right: 370,
      bottom: 470,
    });
    // PROFILE_FRAME_TEMPLATE in users.rs
    expect(FRAME_TEMPLATE.safe).toEqual({
      left: 40,
      top: 80,
      right: 360,
      bottom: 460,
    });
    expect(FRAME_TEMPLATE.crest).toEqual({
      left: 120,
      top: 80,
      right: 280,
      bottom: 110,
    });
    expect(FRAME_ALPHA_LIMIT).toBe(16);
  });
});

describe("frameCover", () => {
  it("passes a file drawn only outside the safe zone and in the crest window", () => {
    const data = file(
      // the whole reach above the card and the 10 px band
      [0, 0, W, 160],
      [0, 0, 80, H],
      [720, 0, W, H],
      [0, 920, W, H],
      // the crest window
      [240, 160, 560, 220],
    );
    expect(frameCover(data, W, H)).toEqual({ pixels: 0 });
  });

  it("counts the faint spill the backend lets through as clear", () => {
    const data = file([80, 160, 720, 920, FRAME_ALPHA_LIMIT]);
    expect(frameCover(data, W, H).pixels).toBe(0);
  });

  it("refuses one pixel over the card's content", () => {
    const data = file([400, 600, 401, 601, FRAME_ALPHA_LIMIT + 1]);
    expect(frameCover(data, W, H)).toEqual({
      pixels: 1,
      place: "text",
      box: { left: 400, top: 600, right: 401, bottom: 601 },
    });
  });

  it("says which part of the card the art lies over", () => {
    // beside the crest window, on the banner
    expect(frameCover(file([100, 170, 120, 180]), W, H).place).toBe("banner");
    // under the banner: the avatar and the name
    expect(frameCover(file([100, 400, 140, 440]), W, H).place).toBe("name");
    expect(frameCover(file([100, 700, 140, 720]), W, H).place).toBe("text");
  });

  it("keeps the crest window to the banner's top", () => {
    // just below the window, in its columns
    expect(frameCover(file([300, 220, 310, 230]), W, H).place).toBe("banner");
  });
});

describe("frameCoverOfFrames", () => {
  const clear = () => file([0, 0, W, 160]);
  const overName = () => file([0, 0, W, 160], [100, 400, 140, 440]);

  it("checks every picture of a moving frame, not only the first", async () => {
    const cover = await frameCoverOfFrames(
      [clear(), clear(), overName()],
      W,
      H,
    );
    expect(cover).toMatchObject({ pixels: 1600, place: "name", frame: 2 });
  });

  it("passes when every picture keeps the card clear", async () => {
    expect(await frameCoverOfFrames([clear(), clear()], W, H)).toEqual({
      pixels: 0,
    });
  });

  it("stops at the frame limit the server keeps", async () => {
    let read = 0;
    function* many() {
      for (let i = 0; i < FRAME_MAX_FRAMES + 50; i++) {
        read++;
        yield clear();
      }
    }
    expect(await frameCoverOfFrames(many(), W, H)).toEqual({ pixels: 0 });
    expect(read).toBe(FRAME_MAX_FRAMES);
    expect(FRAME_MAX_FRAMES).toBe(240);
  });
});

describe("frame file checks", () => {
  it("a file of the exact size with a clear card passes", () => {
    const checks = fileChecks("frames", {
      ...facts(),
      frameCover: { pixels: 0 },
    });
    expect(checks.map((c) => [c.id, c.state])).toEqual([
      ["size", "ok"],
      ["format", "ok"],
      ["weight", "ok"],
      ["safe", "ok"],
      ["motion", "ok"],
    ]);
    expect(fileRefused(checks)).toBe(false);
  });

  it("another size fails: the server takes this size only", () => {
    const checks = fileChecks("frames", facts(1024, 1024));
    expect(checks[0]).toEqual({
      id: "size",
      state: "fail",
      reason: "frame-size",
    });
    expect(fileRefused(checks)).toBe(true);
  });

  it("art over the name fails and says so", () => {
    const checks = fileChecks("frames", {
      ...facts(),
      frameCover: { pixels: 40, place: "name" },
    });
    expect(checks.find((c) => c.id === "safe")).toEqual({
      id: "safe",
      state: "fail",
      reason: "covers-name",
    });
  });

  it("a moving file passes and says it moves", () => {
    const checks = fileChecks("frames", {
      ...facts(),
      type: "image/gif",
      animated: true,
      frameCover: { pixels: 0 },
    });
    expect(checks.at(-1)).toEqual({
      id: "motion",
      state: "ok",
      reason: "frame-moves",
    });
    expect(fileRefused(checks)).toBe(false);
  });

  it("a moving file whose later picture covers the text fails", () => {
    const checks = fileChecks("frames", {
      ...facts(),
      animated: true,
      frameCover: { pixels: 1, place: "text", frame: 2 },
    });
    expect(checks.find((c) => c.id === "safe")).toEqual({
      id: "safe",
      state: "fail",
      reason: "covers-text",
    });
    expect(fileRefused(checks)).toBe(true);
  });

  it("the studio's numbers are the template's", () => {
    expect(STUDIO_SPECS.frames).toMatchObject({
      width: 800,
      height: 1020,
      maxBytes: 2_500_000,
      mustMove: false,
    });
    expect(isFrameSize(800, 1020)).toBe(true);
    expect(isFrameSize(1020, 800)).toBe(false);
  });
});

describe("frames in the community API helpers", () => {
  it("takes PNG, animated PNG, WebP and GIF, not WebM", () => {
    for (const type of ["image/png", "image/apng", "image/webp", "image/gif"])
      expect(checkCommunityFile({ type, size: 1000 }, "frames")).toBe(
        undefined,
      );
    for (const type of ["video/webm", "image/jpeg"])
      expect(checkCommunityFile({ type, size: 1000 }, "frames")).toBe("type");
  });

  it("refuses a file over 2.5 MB", () => {
    expect(
      checkCommunityFile({ type: "image/png", size: 2_500_001 }, "frames"),
    ).toBe("size");
    expect(
      checkCommunityFile({ type: "image/png", size: 2_500_000 }, "frames"),
    ).toBe(undefined);
  });

  it("knows a frame item and its shape", () => {
    expect(kindOf({ kind: "Frame" })).toBe("frames");
    expect(artFit("frames", 800, 1020)).toBe(undefined);
    expect(artFit("frames", 400, 510)).toBe("frame-size");
  });

  it("reads the server's frame refusals", () => {
    for (const rule of ["covers_content", "frame_size", "frame_still"])
      expect(
        effectProblem({
          type: "FailedValidation",
          fields: [{ field: "file", rule }],
        }),
      ).toBe(rule);
  });
});
