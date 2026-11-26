import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  PACK_MAX_ITEMS,
  designsLeft,
  isJunk,
  kindOfItem,
  kindOfPath,
  kindOfShape,
  nameOfPath,
  packItems,
  packProblem,
  packTooBig,
} from "./packModel";
import { ZipError, listZip, readZipEntry } from "./zip";

/** A real ZIP, written by hand: stored or deflated entries */
function zip(files: { path: string; data: Uint8Array; deflate?: boolean }[]) {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.path);
    const body = file.deflate ? deflateRawSync(file.data) : file.data;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(6, 0x800, true);
    local.setUint16(8, file.deflate ? 8 : 0, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    locals.push(new Uint8Array(local.buffer), name, body);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(8, 0x800, true);
    central.setUint16(10, file.deflate ? 8 : 0, true);
    central.setUint32(20, body.length, true);
    central.setUint32(24, file.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const dirSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  return new Blob([
    ...locals,
    ...centrals,
    new Uint8Array(end.buffer),
  ] as BlobPart[]);
}

const bytes = (text: string) => new TextEncoder().encode(text);

describe("zip", () => {
  it("lists files and reads stored and deflated ones", async () => {
    const archive = zip([
      { path: "pack/", data: new Uint8Array() },
      { path: "pack/a.png", data: bytes("stored body") },
      {
        path: "pack/b.gif",
        data: bytes("deflated ".repeat(50)),
        deflate: true,
      },
    ]);
    const entries = await listZip(archive);
    expect(entries.map((entry) => entry.path)).toEqual([
      "pack/a.png",
      "pack/b.gif",
    ]);
    const a = await readZipEntry(archive, entries[0], "image/png");
    expect(a.type).toBe("image/png");
    expect(await a.text()).toBe("stored body");
    const b = await readZipEntry(archive, entries[1]);
    expect(await b.text()).toBe("deflated ".repeat(50));
  });

  it("refuses what is not a ZIP", async () => {
    await expect(listZip(new Blob([bytes("hello")]))).rejects.toBeInstanceOf(
      ZipError,
    );
  });
});

describe("pack model", () => {
  it("leaves out junk and files that are not designs", async () => {
    const entries = await listZip(
      zip([
        { path: "__MACOSX/._a.png", data: bytes("x") },
        { path: ".DS_Store", data: bytes("x") },
        { path: "readme.txt", data: bytes("x") },
        { path: "nameplates/Neon_bar-02.webp", data: bytes("x") },
        { path: "glow ring.png", data: bytes("x") },
      ]),
    );
    const items = packItems(entries);
    expect(items.map((item) => item.name)).toEqual([
      "Neon bar 02",
      "Glow ring",
    ]);
    expect(items[0].folderKind).toBe("nameplates");
    expect(items[1].folderKind).toBeUndefined();
    expect(kindOfItem(items[1], "frames")).toBe("frames");
    expect(kindOfItem({ ...items[0], kind: "decorations" }, "frames")).toBe(
      "decorations",
    );
  });

  it("reads the type from the deepest type folder", () => {
    expect(kindOfPath("Effects/old/Frame/x.png")).toBe("frames");
    expect(kindOfPath("misc/x.png")).toBeUndefined();
    expect(isJunk("a/.hidden/x.png")).toBe(true);
    expect(nameOfPath("a/" + "x".repeat(40) + ".png")).toHaveLength(32);
  });

  it("reads the type from folder words and, without one, from the shape", () => {
    expect(kindOfPath("pack/Name Plates/x.png")).toBe("nameplates");
    expect(kindOfPath("pack/profile-effects/x.png")).toBe("effects");
    expect(kindOfPath("pack/Avatar_Decorations/x.png")).toBe("decorations");
    expect(kindOfShape(800, 1020)).toBe("frames");
    expect(kindOfShape(540, 960)).toBe("effects");
    expect(kindOfShape(512, 512)).toBe("decorations");
    expect(kindOfShape(1024, 192)).toBe("nameplates");
    expect(kindOfShape(700, 300)).toBeUndefined();
  });

  it("takes no WebM: only PNG, APNG, GIF and WebP", async () => {
    const entries = await listZip(
      zip([
        { path: "a.webm", data: bytes("x") },
        { path: "b.apng", data: bytes("x") },
        { path: "c.GIF", data: bytes("x") },
      ]),
    );
    expect(packItems(entries).map((item) => item.type)).toEqual([
      "image/apng",
      "image/gif",
    ]);
  });

  it("caps a pack", async () => {
    const files = Array.from({ length: PACK_MAX_ITEMS + 3 }, (_, i) => ({
      path: `d${i}.png`,
      data: bytes("x"),
    }));
    const entries = await listZip(zip(files));
    expect(packItems(entries)).toHaveLength(PACK_MAX_ITEMS);
    expect(packTooBig(entries)).toBe(true);
  });

  it("checks each design by the single-design rules", () => {
    const base = {
      id: "a.png",
      entry: {
        path: "a.png",
        size: 1000,
        compressedSize: 1000,
        method: 0,
        encrypted: false,
        offset: 0,
      },
      type: "image/png",
      name: "Ring",
      include: true,
      width: 512,
      height: 512,
    };
    expect(packProblem(base, "decorations")).toBeUndefined();
    expect(packProblem({ ...base, name: "x" }, "decorations")).toBe("name");
    expect(
      packProblem(
        { ...base, entry: { ...base.entry, size: 9e6 } },
        "decorations",
      ),
    ).toBe("size");
    expect(packProblem(base, "frames")).toBe("frame-size");
    expect(packProblem({ ...base, width: 800, height: 1020 }, "frames")).toBe(
      undefined,
    );
    expect(packProblem(base, "effects")).toBe("shape");
    expect(
      packProblem({ ...base, width: 2048, height: 2048 }, "decorations"),
    ).toBe("dimension");
    expect(packProblem({ ...base, type: "video/webm" }, "frames")).toBe("type");
  });

  it("counts the room left today and in total; top ranks have no limit", () => {
    const perms = { permissions: [] };
    expect(
      designsLeft({ ...perms, unlimited_designs: true }, 99),
    ).toBeUndefined();
    expect(
      designsLeft(
        {
          ...perms,
          max_designs: 50,
          max_designs_per_day: 20,
          designs_today: 18,
        },
        10,
      ),
    ).toBe(2);
    expect(
      designsLeft(
        {
          ...perms,
          max_designs: 50,
          max_designs_per_day: 20,
          designs_today: 0,
        },
        45,
      ),
    ).toBe(5);
    // an older server says nothing: the server still decides
    expect(designsLeft(perms, 10)).toBeUndefined();
  });
});
