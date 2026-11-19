import { describe, expect, it } from "vitest";

import {
  CUT_PRE_SKIP,
  type OpusPacket,
  PacketRing,
  muxOggOpus,
  oggCrc,
  packetsSeconds,
} from "./oggOpus";

/** A 20 ms packet of `size` bytes, filled with a marker */
function packet(marker: number, size = 80): OpusPacket {
  return { data: new Uint8Array(size).fill(marker & 0xff), samples: 960 };
}

type Page = {
  flags: number;
  granule: number;
  sequence: number;
  serial: number;
  packets: Uint8Array[];
  crcOk: boolean;
};

/** Read a file back the way a player does */
function pages(file: Uint8Array): Page[] {
  const out: Page[] = [];
  let offset = 0;
  while (offset < file.length) {
    const view = new DataView(file.buffer, file.byteOffset + offset);
    expect(String.fromCharCode(...file.subarray(offset, offset + 4))).toBe(
      "OggS",
    );
    const segments = file[offset + 26];
    const lacing = file.subarray(offset + 27, offset + 27 + segments);
    const bodySize = lacing.reduce((sum, value) => sum + value, 0);
    const size = 27 + segments + bodySize;

    const copy = file.slice(offset, offset + size);
    const stored = view.getUint32(22, true);
    copy.set([0, 0, 0, 0], 22);

    const packets: Uint8Array[] = [];
    let cursor = offset + 27 + segments;
    let length = 0;
    for (const value of lacing) {
      length += value;
      if (value < 255) {
        packets.push(file.subarray(cursor, cursor + length));
        cursor += length;
        length = 0;
      }
    }
    out.push({
      flags: file[offset + 5],
      granule: view.getUint32(6, true) + view.getUint32(10, true) * 2 ** 32,
      serial: view.getUint32(14, true),
      sequence: view.getUint32(18, true),
      packets,
      crcOk: oggCrc(copy) === stored,
    });
    offset += size;
  }
  return out;
}

describe("the Ogg checksum", () => {
  it("is zero for nothing and differs from the zip checksum", () => {
    expect(oggCrc(new Uint8Array())).toBe(0);
    // one byte 0x01 is the polynomial itself in this unreflected CRC
    expect(oggCrc(new Uint8Array([1]))).toBe(0x04c11db7);
    // CRC-32 of "123456789" in the zip variant is CBF43926; Ogg's is not
    const digits = new TextEncoder().encode("123456789");
    expect(oggCrc(digits)).toBe(0x89a1897f);
  });
});

describe("an Ogg Opus file", () => {
  it("starts with the two header pages", () => {
    const [head, tags] = pages(muxOggOpus([packet(1)]));
    expect(head.flags).toBe(2);
    expect(head.sequence).toBe(0);
    expect(head.granule).toBe(0);
    const id = head.packets[0];
    expect(new TextDecoder().decode(id.subarray(0, 8))).toBe("OpusHead");
    expect(id.length).toBe(19);
    expect(id[8]).toBe(1); // version
    expect(id[9]).toBe(1); // mono
    const view = new DataView(id.buffer, id.byteOffset);
    expect(view.getUint16(10, true)).toBe(CUT_PRE_SKIP);
    expect(view.getUint32(12, true)).toBe(48_000);
    expect(new TextDecoder().decode(tags.packets[0].subarray(0, 8))).toBe(
      "OpusTags",
    );
    expect(tags.sequence).toBe(1);
  });

  it("keeps every packet, in order, with valid checksums", () => {
    const input = Array.from({ length: 1500 }, (_, index) => packet(index));
    const all = pages(muxOggOpus(input));
    expect(all.every((entry) => entry.crcOk)).toBe(true);
    expect(all.map((entry) => entry.sequence)).toEqual(
      all.map((_, index) => index),
    );
    expect(new Set(all.map((entry) => entry.serial)).size).toBe(1);

    const audio = all.slice(2).flatMap((entry) => entry.packets);
    expect(audio.length).toBe(1500);
    audio.forEach((data, index) => {
      expect(data.length).toBe(80);
      expect(data[0]).toBe(index & 0xff);
    });
  });

  it("counts time in 48 kHz samples and marks the last page", () => {
    const all = pages(muxOggOpus(Array.from({ length: 120 }, () => packet(7))));
    const audio = all.slice(2);
    expect(audio.map((entry) => entry.granule)).toEqual([
      50 * 960,
      100 * 960,
      120 * 960,
    ]);
    expect(audio.map((entry) => entry.flags)).toEqual([0, 0, 4]);
  });

  it("splits packets of 255 bytes and more over segments", () => {
    const sizes = [254, 255, 256, 510, 1275, 0];
    const all = pages(
      muxOggOpus(sizes.map((size, index) => packet(index + 1, size))),
    );
    expect(all.every((entry) => entry.crcOk)).toBe(true);
    expect(all.slice(2).flatMap((entry) => entry.packets.map((p) => p.length))).toEqual(
      sizes,
    );
  });

  it("never puts more than 255 segments on a page", () => {
    // 50 packets of 1275 bytes would need 300 segments
    const file = muxOggOpus(Array.from({ length: 50 }, () => packet(3, 1275)));
    let offset = 0;
    while (offset < file.length) {
      const segments = file[offset + 26];
      expect(segments).toBeLessThanOrEqual(255);
      const body = file
        .subarray(offset + 27, offset + 27 + segments)
        .reduce((sum, value) => sum + value, 0);
      offset += 27 + segments + body;
    }
    expect(offset).toBe(file.length);
  });

  it("plays its packets minus the skipped start", () => {
    expect(packetsSeconds([])).toBe(0);
    expect(packetsSeconds(Array.from({ length: 1504 }, () => packet(1)))).toBe(
      30,
    );
    expect(packetsSeconds([packet(1)], 0)).toBe(0.02);
  });
});

describe("the rolling store a clip is cut from", () => {
  it("is empty at the start", () => {
    const ring = new PacketRing(30);
    expect(ring.seconds).toBe(0);
    expect(ring.take()).toEqual([]);
  });

  it("holds what came in while it is less than its length", () => {
    const ring = new PacketRing(30);
    for (let i = 0; i < 500; i++) ring.push(packet(i));
    expect(ring.take().length).toBe(500);
    expect(ring.seconds).toBeCloseTo(10 - 0.08, 5);
  });

  it("never holds more than its length, and keeps the newest", () => {
    const ring = new PacketRing(30);
    for (let i = 0; i < 10_000; i++) ring.push(packet(i));
    const held = ring.take();
    expect(ring.seconds).toBe(30);
    expect(held.length).toBe(1504);
    expect(held.at(-1)!.data[0]).toBe(9_999 & 0xff);
    expect(held[0].data[0]).toBe((10_000 - 1504) & 0xff);
  });

  it("forgets everything when cleared", () => {
    const ring = new PacketRing(5);
    for (let i = 0; i < 100; i++) ring.push(packet(i));
    ring.clear();
    expect(ring.take()).toEqual([]);
    expect(ring.seconds).toBe(0);
  });

  it("hands out a copy: later packets do not change a clip being saved", () => {
    const ring = new PacketRing(5);
    ring.push(packet(1));
    const taken = ring.take();
    ring.push(packet(2));
    expect(taken.length).toBe(1);
  });
});
