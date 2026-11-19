/**
 * Opus packets in, an Ogg Opus file out (RFC 7845), and the rolling store a
 * clip is cut from. No browser API in here, so it is tested on its own.
 *
 * A clip is the last seconds of a stream that started long before: the
 * decoder needs a moment to settle on such a cut, so the file tells players
 * to skip its first 80 ms (`pre-skip`), as the RFC advises.
 */

/** Opus always counts time at 48 kHz in Ogg */
export const OPUS_RATE = 48_000;
/** Samples skipped at the start of a file cut out of a longer stream */
export const CUT_PRE_SKIP = 3840;

/** One encoded packet and how many 48 kHz samples it holds */
export type OpusPacket = { data: Uint8Array; samples: number };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let bit = 0; bit < 8; bit++)
      r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    table[i] = r >>> 0;
  }
  return table;
})();

/** The checksum Ogg uses (CRC-32, polynomial 04C11DB7, no reflection) */
export function oggCrc(bytes: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++)
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ bytes[i]) & 0xff]) >>> 0;
  return crc;
}

const HEADER_FIRST = 2;
const HEADER_LAST = 4;
/** Most segments a page holds */
const PAGE_SEGMENTS = 255;
/** Packets per page: about a second of audio, so seeking is quick */
const PAGE_PACKETS = 50;

function page(
  packets: Uint8Array[],
  options: { serial: number; sequence: number; granule: number; flags: number },
): Uint8Array {
  const lacing: number[] = [];
  let size = 0;
  for (const packet of packets) {
    let left = packet.length;
    while (left >= 255) {
      lacing.push(255);
      left -= 255;
    }
    lacing.push(left);
    size += packet.length;
  }
  if (lacing.length > PAGE_SEGMENTS) throw new Error("too many segments");

  const out = new Uint8Array(27 + lacing.length + size);
  const view = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53]); // "OggS"
  out[4] = 0;
  out[5] = options.flags;
  // granule position: 64 bits, little endian
  view.setUint32(6, options.granule >>> 0, true);
  view.setUint32(10, Math.floor(options.granule / 0x100000000), true);
  view.setUint32(14, options.serial, true);
  view.setUint32(18, options.sequence, true);
  view.setUint32(22, 0, true);
  out[26] = lacing.length;
  out.set(lacing, 27);
  let offset = 27 + lacing.length;
  for (const packet of packets) {
    out.set(packet, offset);
    offset += packet.length;
  }
  view.setUint32(22, oggCrc(out), true);
  return out;
}

function text(value: string) {
  return new TextEncoder().encode(value);
}

function opusHead(channels: number, preSkip: number): Uint8Array {
  const head = new Uint8Array(19);
  const view = new DataView(head.buffer);
  head.set(text("OpusHead"));
  head[8] = 1;
  head[9] = channels;
  view.setUint16(10, preSkip, true);
  view.setUint32(12, OPUS_RATE, true);
  view.setInt16(16, 0, true);
  head[18] = 0;
  return head;
}

function opusTags(): Uint8Array {
  const vendor = text("Zrzur");
  const tags = new Uint8Array(8 + 4 + vendor.length + 4);
  const view = new DataView(tags.buffer);
  tags.set(text("OpusTags"));
  view.setUint32(8, vendor.length, true);
  tags.set(vendor, 12);
  view.setUint32(12 + vendor.length, 0, true);
  return tags;
}

/** Packets that fit one page (by count and by segments) from `start` */
function pageEnd(packets: OpusPacket[], start: number): number {
  let segments = 0;
  let end = start;
  while (end < packets.length && end - start < PAGE_PACKETS) {
    const needed = Math.floor(packets[end].data.length / 255) + 1;
    if (segments + needed > PAGE_SEGMENTS) break;
    segments += needed;
    end++;
  }
  // a packet too big for an empty page cannot happen with Opus (at most
  // 1275 bytes a frame); never loop forever if it does
  return Math.max(end, start + 1);
}

/**
 * An Ogg Opus file from packets in order.
 * @param preSkip Samples players drop at the start (see CUT_PRE_SKIP)
 */
export function muxOggOpus(
  packets: OpusPacket[],
  options: { channels?: number; preSkip?: number; serial?: number } = {},
): Uint8Array {
  const serial = options.serial ?? 0x5a525a52;
  const parts: Uint8Array[] = [
    page([opusHead(options.channels ?? 1, options.preSkip ?? CUT_PRE_SKIP)], {
      serial,
      sequence: 0,
      granule: 0,
      flags: HEADER_FIRST,
    }),
    page([opusTags()], { serial, sequence: 1, granule: 0, flags: 0 }),
  ];

  let sequence = 2;
  let granule = 0;
  for (let start = 0; start < packets.length; ) {
    const end = pageEnd(packets, start);
    const slice = packets.slice(start, end);
    for (const packet of slice) granule += packet.samples;
    parts.push(
      page(
        slice.map((packet) => packet.data),
        {
          serial,
          sequence: sequence++,
          granule,
          flags: end >= packets.length ? HEADER_LAST : 0,
        },
      ),
    );
    start = end;
  }

  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const file = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    file.set(part, offset);
    offset += part.length;
  }
  return file;
}

/** Seconds of audio a file made from these packets plays */
export function packetsSeconds(packets: OpusPacket[], preSkip = CUT_PRE_SKIP) {
  const samples = packets.reduce((sum, packet) => sum + packet.samples, 0);
  return Math.max(0, samples - preSkip) / OPUS_RATE;
}

/**
 * The last seconds of a stream of packets: older ones fall out as new ones
 * come in, so it never holds more than it may.
 */
export class PacketRing {
  #packets: OpusPacket[] = [];
  #samples = 0;
  readonly #maxSamples: number;

  /** @param seconds How much to keep (a little more is kept for the pre-skip) */
  constructor(seconds: number) {
    this.#maxSamples = Math.round(seconds * OPUS_RATE) + CUT_PRE_SKIP;
  }

  push(packet: OpusPacket) {
    this.#packets.push(packet);
    this.#samples += packet.samples;
    while (
      this.#packets.length > 1 &&
      this.#samples - this.#packets[0].samples >= this.#maxSamples
    ) {
      this.#samples -= this.#packets.shift()!.samples;
    }
  }

  /** Seconds a clip cut now would play */
  get seconds() {
    return packetsSeconds(this.#packets);
  }

  /** The packets held now, oldest first (a copy of the list) */
  take(): OpusPacket[] {
    return this.#packets.slice();
  }

  clear() {
    this.#packets = [];
    this.#samples = 0;
  }
}
