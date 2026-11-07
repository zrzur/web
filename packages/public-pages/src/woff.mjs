import { inflateSync } from "node:zlib";

/**
 * WOFF (version 1) to a plain TrueType/OpenType font, so the image renderer
 * can use the IBM Plex files the app already ships (fontsource has WOFF
 * only). Each table is copied, inflated when it was compressed.
 */
export function woffToSfnt(woff) {
  const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  if (view.getUint32(0) !== 0x774f4646) throw new Error("not a WOFF file");

  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const offset = view.getUint32(at + 4);
    const compLength = view.getUint32(at + 8);
    const origLength = view.getUint32(at + 12);
    const raw = woff.subarray(offset, offset + compLength);
    tables.push({
      tag: view.getUint32(at),
      checksum: view.getUint32(at + 16),
      data: compLength < origLength ? inflateSync(raw) : raw,
    });
  }

  const pad = (n) => (n + 3) & ~3;
  const headerSize = 12 + numTables * 16;
  const size = tables.reduce((sum, t) => sum + pad(t.data.length), headerSize);
  const out = Buffer.alloc(size);

  let power = 1;
  let log = 0;
  while (power * 2 <= numTables) {
    power *= 2;
    log++;
  }
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(power * 16, 6);
  out.writeUInt16BE(log, 8);
  out.writeUInt16BE(numTables * 16 - power * 16, 10);

  let offset = headerSize;
  tables.forEach((table, i) => {
    const at = 12 + i * 16;
    out.writeUInt32BE(table.tag, at);
    out.writeUInt32BE(table.checksum, at + 4);
    out.writeUInt32BE(offset, at + 8);
    out.writeUInt32BE(table.data.length, at + 12);
    Buffer.from(table.data).copy(out, offset);
    offset += pad(table.data.length);
  });
  return out;
}
