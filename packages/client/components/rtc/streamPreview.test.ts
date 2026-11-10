import { describe, expect, it } from "vitest";

import {
  PREVIEW_MAX_BYTES,
  PREVIEW_QUALITIES,
  encodeStill,
  previewSize,
  toBase64,
} from "./streamPreview";

describe("stream preview stills", () => {
  it("fit a 320×180 box and keep the picture's shape", () => {
    expect(previewSize(1920, 1080)).toEqual({ width: 320, height: 180 });
    expect(previewSize(2560, 1440)).toEqual({ width: 320, height: 180 });
    // a tall window: as high as the box, narrower
    expect(previewSize(1080, 1920)).toEqual({ width: 101, height: 180 });
    // an ultra-wide screen: as wide as the box, lower
    expect(previewSize(3440, 1440)).toEqual({ width: 320, height: 134 });
    // never larger than the share itself
    expect(previewSize(200, 100)).toEqual({ width: 200, height: 100 });
    expect(previewSize(0, 0)).toEqual({ width: 320, height: 180 });
  });

  it("lower the quality until the still is at most 20 KB", async () => {
    const tried: number[] = [];
    const sizes = [40_000, 25_000, 12_000];
    const image = await encodeStill({} as HTMLCanvasElement, async (_c, q) => {
      tried.push(q);
      return new Blob([new Uint8Array(sizes[tried.length - 1] ?? 1)]);
    });
    expect(tried).toEqual(PREVIEW_QUALITIES.slice(0, 3));
    expect(image).toBeDefined();
    expect(atob(image!).length).toBe(12_000);
    expect(atob(image!).length).toBeLessThanOrEqual(PREVIEW_MAX_BYTES);
  });

  it("send nothing when no quality fits", async () => {
    const image = await encodeStill(
      {} as HTMLCanvasElement,
      async () => new Blob([new Uint8Array(PREVIEW_MAX_BYTES + 1)]),
    );
    expect(image).toBeUndefined();
  });

  it("encode bytes as plain base64", () => {
    expect(toBase64(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("/9j/");
    const big = new Uint8Array(70_000).fill(65);
    expect(atob(toBase64(big))).toBe("A".repeat(70_000));
  });
});
