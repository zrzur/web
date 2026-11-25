import { FRAME_MAX_FRAMES } from "./frameCheck";

/** The part of WebCodecs' `ImageDecoder` this file uses */
type Decoder = {
  completed: Promise<void>;
  tracks: {
    ready: Promise<void>;
    selectedTrack: { frameCount: number } | null;
  };
  decode(options: { frameIndex: number }): Promise<{
    image: CanvasImageSource & { close(): void };
  }>;
  close(): void;
};
type DecoderClass = {
  new (init: { data: ArrayBuffer; type: string }): Decoder;
  isTypeSupported(type: string): Promise<boolean>;
};

/**
 * Every picture of a moving file, whole and in RGBA, read by the browser's
 * own decoder (`ImageDecoder`), at most `FRAME_MAX_FRAMES`. A browser without
 * it yields nothing: the server checks every frame on upload all the same.
 */
export async function* framePictures(
  bytes: ArrayBuffer,
  type: string,
  width: number,
  height: number,
): AsyncGenerator<Uint8ClampedArray> {
  const ImageDecoder = (globalThis as { ImageDecoder?: DecoderClass })
    .ImageDecoder;
  // an animated PNG is read as a PNG
  const format = type === "image/apng" ? "image/png" : type;
  if (!ImageDecoder || !(await ImageDecoder.isTypeSupported(format))) return;
  const decoder = new ImageDecoder({ data: bytes, type: format });
  try {
    await decoder.completed;
    await decoder.tracks.ready;
    const count = Math.min(
      decoder.tracks.selectedTrack?.frameCount ?? 1,
      FRAME_MAX_FRAMES,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    for (let frameIndex = 0; frameIndex < count; frameIndex++) {
      const { image } = await decoder.decode({ frameIndex });
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0);
      image.close();
      yield context.getImageData(0, 0, width, height).data;
    }
  } finally {
    decoder.close();
  }
}
