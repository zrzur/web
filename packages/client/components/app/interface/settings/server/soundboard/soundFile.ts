/** Longest sound a soundboard takes, in milliseconds */
export const SOUND_MAX_MS = 5_200;

/** Size limit when the server names none */
export const SOUND_DEFAULT_BYTES = 512_000;

/** File types every browser plays */
export const SOUND_TYPES = [
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
];

/** What is wrong with a picked file, before anything is uploaded */
export type SoundProblem = "type" | "size" | "length" | "unreadable";

/**
 * Check a picked sound: its type, size and length
 * @param file The file
 * @param maxBytes Size limit
 * @param measure Length in milliseconds (decodes the file)
 * @returns the length, or what is wrong
 */
export async function checkSound(
  file: File,
  maxBytes: number,
  measure: (file: File) => Promise<number> = measureSound,
): Promise<{ durationMs: number } | { problem: SoundProblem }> {
  if (!SOUND_TYPES.includes(file.type) && !/\.(mp3|ogg|wav)$/i.test(file.name))
    return { problem: "type" };
  if (file.size > maxBytes) return { problem: "size" };
  let durationMs: number;
  try {
    durationMs = Math.round(await measure(file));
  } catch {
    return { problem: "unreadable" };
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0)
    return { problem: "unreadable" };
  if (durationMs > SOUND_MAX_MS) return { problem: "length" };
  return { durationMs };
}

/** Length of a sound in milliseconds (decoded on this device, offline) */
export async function measureSound(file: File): Promise<number> {
  const context = new OfflineAudioContext(1, 1, 44_100);
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  return buffer.duration * 1000;
}

/** A name from the file name: "air-horn.mp3" → "air horn" */
export function nameFromFile(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .slice(0, 32);
}
