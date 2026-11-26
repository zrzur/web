/**
 * Reads a ZIP file in the browser without loading it all: the central
 * directory at the end says where each file is, and a file is read (and
 * inflated with the browser's own DecompressionStream) only when asked
 * for. Packs of any size work; only the files taken out are held in memory.
 *
 * Stored (0) and deflated (8) entries, ZIP64 sizes and offsets, UTF-8
 * names. Encrypted entries are listed but can't be read.
 */

export type ZipEntry = {
  /** path inside the archive, folders separated by "/" */
  path: string;
  /** size once taken out */
  size: number;
  /** size in the archive */
  compressedSize: number;
  method: number;
  encrypted: boolean;
  /** where the entry's local header starts */
  offset: number;
};

export class ZipError extends Error {
  constructor(public reason: "not-zip" | "unsupported" | "damaged") {
    super(reason);
  }
}

const EOCD = 0x06054b50;
const EOCD64 = 0x06064b50;
const EOCD64_LOCATOR = 0x07064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

async function read(file: Blob, start: number, length: number) {
  const end = Math.min(file.size, start + length);
  return new DataView(await file.slice(start, end).arrayBuffer());
}

/** The files in a ZIP (folders left out), in archive order */
export async function listZip(file: Blob): Promise<ZipEntry[]> {
  // the end record is in the last 22 bytes plus a comment of up to 64 KiB
  const tailLength = Math.min(file.size, 22 + 0xffff + 20);
  const tailStart = file.size - tailLength;
  const tail = await read(file, tailStart, tailLength);
  let at = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD) {
      at = i;
      break;
    }
  }
  if (at < 0) throw new ZipError("not-zip");

  let count = tail.getUint16(at + 10, true);
  let dirSize = tail.getUint32(at + 12, true);
  let dirOffset = tail.getUint32(at + 16, true);

  // ZIP64: the real numbers are in the ZIP64 end record
  if (count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) {
    const locator = at - 20;
    if (locator < 0 || tail.getUint32(locator, true) !== EOCD64_LOCATOR)
      throw new ZipError("damaged");
    const recordOffset = Number(tail.getBigUint64(locator + 8, true));
    const record = await read(file, recordOffset, 56);
    if (record.getUint32(0, true) !== EOCD64) throw new ZipError("damaged");
    count = Number(record.getBigUint64(32, true));
    dirSize = Number(record.getBigUint64(40, true));
    dirOffset = Number(record.getBigUint64(48, true));
  }

  if (dirOffset + dirSize > file.size) throw new ZipError("damaged");
  const dir = await read(file, dirOffset, dirSize);
  const decoder = new TextDecoder();
  const latin1 = new TextDecoder("latin1");
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > dir.byteLength || dir.getUint32(p, true) !== CENTRAL)
      throw new ZipError("damaged");
    const flags = dir.getUint16(p + 8, true);
    const method = dir.getUint16(p + 10, true);
    let compressedSize = dir.getUint32(p + 20, true);
    let size = dir.getUint32(p + 24, true);
    const nameLength = dir.getUint16(p + 28, true);
    const extraLength = dir.getUint16(p + 30, true);
    const commentLength = dir.getUint16(p + 32, true);
    let offset = dir.getUint32(p + 42, true);
    const nameBytes = new Uint8Array(
      dir.buffer,
      dir.byteOffset + p + 46,
      nameLength,
    );
    // bit 11: UTF-8 names; old tools write their own code page
    const path = (flags & 0x800 ? decoder : latin1).decode(nameBytes);

    // ZIP64 extra field: the sizes and offset that did not fit
    let e = p + 46 + nameLength;
    const extraEnd = e + extraLength;
    while (e + 4 <= extraEnd) {
      const id = dir.getUint16(e, true);
      const length = dir.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) {
          size = Number(dir.getBigUint64(q, true));
          q += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = Number(dir.getBigUint64(q, true));
          q += 8;
        }
        if (offset === 0xffffffff) offset = Number(dir.getBigUint64(q, true));
      }
      e += 4 + length;
    }

    if (!path.endsWith("/"))
      entries.push({
        path,
        size,
        compressedSize,
        method,
        encrypted: (flags & 0x1) !== 0,
        offset,
      });
    p = extraEnd + commentLength;
  }
  return entries;
}

/** One file out of the ZIP, as a Blob of `type` */
export async function readZipEntry(
  file: Blob,
  entry: ZipEntry,
  type = "",
): Promise<Blob> {
  if (entry.encrypted) throw new ZipError("unsupported");
  const header = await read(file, entry.offset, 30);
  if (header.getUint32(0, true) !== LOCAL) throw new ZipError("damaged");
  // the local header's own name and extra lengths can differ from the
  // central directory's
  const start =
    entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const data = file.slice(start, start + entry.compressedSize);

  if (entry.method === 0) return new Blob([data], { type });
  if (entry.method !== 8) throw new ZipError("unsupported");
  if (typeof DecompressionStream === "undefined")
    throw new ZipError("unsupported");
  try {
    const stream = data
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    const out = await new Response(stream).blob();
    return type ? new Blob([out], { type }) : out;
  } catch {
    throw new ZipError("damaged");
  }
}
