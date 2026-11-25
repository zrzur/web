import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { COMMUNITY_MAX_BYTES } from "../../components/app/interface/settings/user/profile/communityApi";
import { frameCover } from "../../components/app/interface/settings/user/profile/studio/frameCheck";
import { FRAME_KIT_FILES } from "../../components/app/interface/settings/user/profile/studio/frameKit";
import {
  FRAME_ALPHA_LIMIT,
  FRAME_FILE,
  FRAME_TEMPLATE,
} from "../../components/ui/components/features/profiles/frames/communityFrame";

import {
  ALPHA_LIMIT,
  FILE,
  MAX_BYTES,
  OUT,
  TEMPLATE,
  coveredPixels,
  exampleFrame,
  frameKitFiles,
} from "./frame-kit.mjs";

/** width, height, colour type and the RGBA rows of a PNG this kit wrote */
function readPng(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  let at = 8;
  let width = 0;
  let height = 0;
  let colour = 0;
  const idat: Buffer[] = [];
  const chunks: string[] = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString("latin1");
    const body = bytes.subarray(at + 8, at + 8 + length);
    chunks.push(type);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colour = body[9];
    }
    if (type === "IDAT") idat.push(body);
    at += 12 + length;
  }
  const rows = inflateSync(Buffer.concat(idat));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    // the kit writes filter 0 (none) on every row
    expect(rows[y * (width * 4 + 1)]).toBe(0);
    rows.copy(
      data,
      y * width * 4,
      y * (width * 4 + 1) + 1,
      (y + 1) * (width * 4 + 1),
    );
  }
  return { width, height, colour, data, chunks };
}

describe("the frame kit", () => {
  const files = frameKitFiles();

  it("uses the same numbers as the app and the server", () => {
    expect(FILE).toEqual(FRAME_FILE);
    expect(TEMPLATE.card).toEqual(FRAME_TEMPLATE.card);
    expect(TEMPLATE.safe).toEqual(FRAME_TEMPLATE.safe);
    expect(TEMPLATE.crest).toEqual(FRAME_TEMPLATE.crest);
    expect(TEMPLATE.slice).toEqual(FRAME_TEMPLATE.slice);
    expect(ALPHA_LIMIT).toBe(FRAME_ALPHA_LIMIT);
    expect(MAX_BYTES).toBe(COMMUNITY_MAX_BYTES);
  });

  it("has an example frame the upload checks take", () => {
    const png = readPng(files.get("example-frame.png")!);
    // the exact size, RGBA, one still picture (no animation chunk)
    expect([png.width, png.height, png.colour]).toEqual([800, 1020, 6]);
    expect(png.chunks).not.toContain("acTL");
    expect(files.get("example-frame.png")!.length).toBeLessThan(MAX_BYTES);
    // nothing over the card's content, by both copies of the rule
    expect(coveredPixels(png.data)).toBe(0);
    expect(frameCover(png.data, png.width, png.height)).toEqual({ pixels: 0 });
    // transparent in the middle, drawn round the edge and in the crest
    const alpha = (x: number, y: number) => png.data[(y * 800 + x) * 4 + 3];
    expect(alpha(400, 500)).toBe(0);
    expect(alpha(400, 140)).toBe(255);
    expect(alpha(400, 162)).toBe(255);
  });

  it("would refuse the example with one more pixel on the name", () => {
    const art = exampleFrame();
    art.data[(420 * 800 + 200) * 4 + 3] = 255;
    expect(coveredPixels(art.data)).toBe(1);
    expect(frameCover(art.data, 800, 1020).place).toBe("name");
  });

  it("has a template of the file's size with every guide layer", () => {
    const png = readPng(files.get("template.png")!);
    expect([png.width, png.height]).toEqual([800, 1020]);
    const svg = files.get("template.svg")!.toString("utf8");
    expect(svg).toContain('width="800" height="1020" viewBox="0 0 800 1020"');
    for (const id of [
      "export-area",
      "reach-area",
      "stretch-zones",
      "grid-4px",
      "card-outline",
      "safe-zone",
      "crest-window",
      "labels",
    ])
      expect(svg).toContain(`<g id="${id}" inkscape:groupmode="layer"`);
    // the grid starts at the card's corner
    expect(svg).toContain(
      '<pattern id="grid" x="60" y="140" width="8" height="8"',
    );
  });

  it("says the rules in three languages", () => {
    const text = files.get("README.md")!.toString("utf8");
    for (const heading of ["## English", "## العربية", "## Deutsch"])
      expect(text).toContain(heading);
    // each section names the size, the safe zone, the limit and the formats
    expect(text.match(/800 × 1020/g)?.length).toBe(3);
    expect(text.match(/80,160/g)?.length).toBe(3);
    expect(text.match(/2\.5/g)?.length).toBe(3);
    expect(text.match(/PNG/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("has a palette as JSON and as ASE", () => {
    const json = JSON.parse(files.get("palette.json")!.toString("utf8"));
    expect(json.colours).toContainEqual({
      group: "Zrzur",
      name: "Action pink-red",
      value: "#E0195F",
    });
    const ase = files.get("palette.ase")!;
    expect(ase.subarray(0, 4).toString("latin1")).toBe("ASEF");
    // two groups: start and end blocks, and one block per colour
    expect(ase.readUInt32BE(8)).toBe(json.colours.length + 4);
  });

  it("packs every file into one zip", () => {
    const zip = files.get("zrzur-frame-kit.zip")!;
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 10)).toBe(6);
    const text = zip.toString("latin1");
    for (const name of [
      "README.md",
      "template.svg",
      "template.png",
      "example-frame.png",
      "palette.json",
      "palette.ase",
    ])
      expect(text).toContain(`zrzur-frame-kit/${name}`);
  });

  it("is what public/frame-kit holds, and what the app links to", () => {
    for (const [name, bytes] of files)
      expect(
        readFileSync(join(OUT, name)).equals(bytes),
        `${name} is out of date: run node scripts/designs/frame-kit.mjs`,
      ).toBe(true);
    for (const name of Object.values(FRAME_KIT_FILES))
      expect(files.has(name)).toBe(true);
  });
});
