import { describe, expect, it } from "vitest";

import { drawnBox, fitDrawing, fitRow } from "./userStyle";

/** An image of `w` x `h` with opaque pixels only inside the box */
function image(w: number, h: number, box: { minX: number; minY: number; maxX: number; maxY: number }) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = box.minY; y <= box.maxY; y++)
    for (let x = box.minX; x <= box.maxX; x++) data[(y * w + x) * 4 + 3] = 255;
  return data;
}

describe("a nameplate's drawing fills its box", () => {
  it("finds the drawn part of the image", () => {
    const box = { minX: 24, minY: 11, maxX: 499, maxY: 84 };
    expect(drawnBox(image(512, 96, box), 512, 96)).toEqual(box);
    expect(drawnBox(new Uint8ClampedArray(4 * 4 * 4), 4, 4)).toBeUndefined();
  });

  it("stretches the drawing to the whole box, margins left out", () => {
    // the nameplate the owner wears: 512 x 96 with margins all round
    const fit = fitDrawing(512, 96, { minX: 24, minY: 11, maxX: 499, maxY: 84 })!;
    const [sx, sy] = fit.size.split(" ").map(parseFloat);
    const [px, py] = fit.position.split(" ").map(parseFloat);
    // drawn part 476 x 74 → the image is 107.6% x 129.7% of the box
    expect(sx).toBeCloseTo((512 / 476) * 100, 2);
    expect(sy).toBeCloseTo((96 / 74) * 100, 2);
    // the drawing's left and top edges land on the box's left and top
    const boxW = 243;
    const boxH = 44;
    const imgW = (boxW * sx) / 100;
    const imgH = (boxH * sy) / 100;
    const left = ((boxW - imgW) * px) / 100;
    const top = ((boxH - imgH) * py) / 100;
    expect(left + (24 / 512) * imgW).toBeCloseTo(0, 2);
    expect(top + (11 / 96) * imgH).toBeCloseTo(0, 2);
    // and the right and bottom edges on the box's right and bottom
    expect(left + (500 / 512) * imgW).toBeCloseTo(boxW, 2);
    expect(top + (85 / 96) * imgH).toBeCloseTo(boxH, 2);
  });

  it("leaves a drawing that already fills its image as it is", () => {
    expect(fitDrawing(512, 96, { minX: 0, minY: 0, maxX: 511, maxY: 95 })).toBeUndefined();
    expect(fitDrawing(512, 96, { minX: 3, minY: 1, maxX: 509, maxY: 95 })).toBeUndefined();
  });

  it("trims a margin on one side only", () => {
    const fit = fitDrawing(100, 100, { minX: 0, minY: 20, maxX: 99, maxY: 99 })!;
    expect(fit.size).toBe("100% 125%");
    expect(fit.position).toBe("50% 100%");
  });
});

describe("a nameplate in a member row, as Discord shows one", () => {
  it("keeps the drawing's shape, fills the row's height, holds it to the end", () => {
    const box = { minX: 24, minY: 11, maxX: 499, maxY: 84 };
    const fit = fitRow(512, 96, box, 44);
    const [w, h] = fit.size.split(" ").map(parseFloat);
    // the same scale both ways: nothing is squashed
    expect(w / 512).toBeCloseTo(h / 96, 3);
    // the drawing is exactly the row's height
    expect(((box.maxY - box.minY + 1) * h) / 96).toBeCloseTo(44, 1);
    // its right edge on the row's right edge (left-to-right), or its left edge
    // on the row's left (right-to-left), and its top on the row's top
    const [right, left, top] = [...fit.position.matchAll(/(-?[\d.]+)px/g)].map((m) => parseFloat(m[1]));
    expect(right).toBeCloseTo(((512 - 1 - 499) * h) / 96, 1);
    expect(left).toBeCloseTo((24 * h) / 96, 1);
    expect(top).toBeCloseTo(-(11 * h) / 96, 1);
    expect(fit.position).toContain("var(--z-plate-ltr, 1) * (100% +");
  });
});

