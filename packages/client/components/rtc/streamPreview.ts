/**
 * Stream previews: while you share your screen, your own client takes a
 * small still of it every 30 seconds and sends it (at most 20 KB). Others
 * see it when they hover the share before joining. The server never decodes
 * video, and nobody downloads a preview they do not look at.
 */

/** Seconds between two stills */
export const PREVIEW_INTERVAL_MS = 30_000;
/** The first still, once the share has settled */
export const PREVIEW_FIRST_MS = 3_000;
/** Largest still sent */
export const PREVIEW_MAX_BYTES = 20_000;
/** Size of a still (16:9 box; the picture keeps its own shape inside) */
export const PREVIEW_WIDTH = 320;
export const PREVIEW_HEIGHT = 180;

/** Size that fits a w×h picture into the preview box, keeping its shape */
export function previewSize(width: number, height: number) {
  if (!width || !height)
    return { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT };
  const scale = Math.min(PREVIEW_WIDTH / width, PREVIEW_HEIGHT / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Qualities tried in turn until the still fits the size limit */
export const PREVIEW_QUALITIES = [0.7, 0.5, 0.35, 0.2];

/**
 * Encode a canvas as the smallest JPEG that is good enough and fits
 * @returns base64 without the data: prefix, or undefined when nothing fits
 */
export async function encodeStill(
  canvas: HTMLCanvasElement,
  toBlob: (
    canvas: HTMLCanvasElement,
    quality: number,
  ) => Promise<Blob | null> = (c, quality) =>
    new Promise((resolve) => c.toBlob(resolve, "image/jpeg", quality)),
): Promise<string | undefined> {
  for (const quality of PREVIEW_QUALITIES) {
    const blob = await toBlob(canvas, quality);
    if (blob && blob.size <= PREVIEW_MAX_BYTES) {
      return toBase64(new Uint8Array(await blob.arrayBuffer()));
    }
  }
  return undefined;
}

/** base64 of some bytes, in pieces (a still is a few KB) */
export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Resolves when the video element shows a new frame (or after a second,
 * for browsers without requestVideoFrameCallback or a still screen)
 */
export function nextFrame(video: HTMLVideoElement, timeoutMs = 1000) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    if (typeof video.requestVideoFrameCallback === "function")
      video.requestVideoFrameCallback(done);
    else
      (video as HTMLVideoElement).addEventListener("loadeddata", done, {
        once: true,
      });
  });
}

/**
 * Take stills of a screen share track until stopped
 * @param track The local screen share video track
 * @param send Sends one still (base64 JPEG)
 * @returns stop
 */
export function startPreviewCapture(
  track: MediaStreamTrack,
  send: (image: string) => Promise<unknown>,
): () => void {
  let stopped = false;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  const canvas = document.createElement("canvas");

  async function capture() {
    if (stopped || track.readyState !== "live") return;
    try {
      // a paused element keeps its last frame: play, then wait for a new one
      await video.play();
      await nextFrame(video);
      if (stopped) return;
      const size = previewSize(video.videoWidth, video.videoHeight);
      canvas.width = size.width;
      canvas.height = size.height;
      canvas.getContext("2d")?.drawImage(video, 0, 0, size.width, size.height);
      const image = await encodeStill(canvas);
      if (image && !stopped) await send(image);
    } catch {
      // a missed still is not worth telling anyone about
    } finally {
      // the video element only plays to take the still
      video.pause();
    }
  }

  const first = setTimeout(capture, PREVIEW_FIRST_MS);
  const every = setInterval(capture, PREVIEW_INTERVAL_MS);

  return () => {
    stopped = true;
    clearTimeout(first);
    clearInterval(every);
    video.pause();
    video.srcObject = null;
  };
}
