import type {
  LocalTrackPublication,
  LocalVideoTrack,
  Room,
  ScreenShareCaptureOptions,
  TrackPublishOptions,
  VideoCodec,
  VideoEncoding,
} from "livekit-client";

/**
 * Screen share quality profiles and the capture/encoder plumbing behind them.
 *
 * Kept free of Solid/app imports so the real-media harness and unit tests can
 * load it on its own.
 */

export type ScreenShareQualityName = "low" | "high" | "motion" | "text";

export type ScreenShareQuality = {
  name: ScreenShareQualityName;
  fullName: string;
  /** 0 means the source size (no downscale) */
  width: number;
  height: number;
  frameRate: number;
  /**
   * "detail"/"text" keep text sharp (WebRTC screencast mode, no denoising);
   * "motion" favours smoothness
   */
  contentHint: "detail" | "text" | "motion";
  /** What the encoder gives up first when bandwidth or CPU run short */
  degradationPreference: RTCDegradationPreference;
  encoding: VideoEncoding;
};

export type ScreenShareLimits = {
  /** [width, height]; 0 = unlimited */
  resolution: [number, number];
  /** highest frame rate the user's plan or the server level allows */
  framerate: number;
};

/**
 * Quality profiles the user may pick from. "low" is always available; the
 * rest follow the resolution and frame rate the plan allows. Bitrate caps are
 * the ones the client used before (LiveKit's screen share presets and the
 * Plus 60 FPS values), they are not raised here.
 */
export function screenShareQualities(
  limits: ScreenShareLimits,
): Partial<Record<ScreenShareQualityName, ScreenShareQuality>> {
  const [maxW, maxH] = limits.resolution;
  const fps60 = limits.framerate >= 60;
  const allows1080 =
    (maxW === 0 || maxW >= 1920) && (maxH === 0 || maxH >= 1080);

  const qualities: Partial<Record<ScreenShareQualityName, ScreenShareQuality>> =
    {
      low: {
        name: "low",
        fullName: fps60 ? "720p 60FPS" : "720p 30FPS",
        width: 1280,
        height: 720,
        frameRate: fps60 ? 60 : 30,
        contentHint: "detail",
        degradationPreference: "maintain-resolution",
        encoding: fps60
          ? { maxBitrate: 4_000_000, maxFramerate: 60 }
          : { maxBitrate: 2_000_000, maxFramerate: 30 },
      },
    };

  if (allows1080) {
    qualities.high = {
      name: "high",
      fullName: "1080p 30FPS",
      width: 1920,
      height: 1080,
      frameRate: 30,
      contentHint: "detail",
      degradationPreference: "maintain-resolution",
      encoding: { maxBitrate: 5_000_000, maxFramerate: 30 },
    };
  }

  // Smoothness first (games, video): may lower resolution under pressure
  // instead of dropping frames
  qualities.motion = allows1080
    ? {
        name: "motion",
        fullName: fps60 ? "1080p 60FPS" : "1080p 30FPS (Motion)",
        width: 1920,
        height: 1080,
        frameRate: fps60 ? 60 : 30,
        contentHint: "motion",
        degradationPreference: "balanced",
        encoding: fps60
          ? { maxBitrate: 8_000_000, maxFramerate: 60 }
          : { maxBitrate: 5_000_000, maxFramerate: 30 },
      }
    : {
        name: "motion",
        fullName: fps60 ? "720p 60FPS (Motion)" : "720p 30FPS (Motion)",
        width: 1280,
        height: 720,
        frameRate: fps60 ? 60 : 30,
        contentHint: "motion",
        degradationPreference: "balanced",
        encoding: fps60
          ? { maxBitrate: 4_000_000, maxFramerate: 60 }
          : { maxBitrate: 2_000_000, maxFramerate: 30 },
      };

  if (allows1080) {
    // Documents and code: full source size (within the plan), few frames
    qualities.text = {
      name: "text",
      fullName: "Source 15FPS (Text)",
      width: maxW,
      height: maxH,
      frameRate: 15,
      contentHint: "text",
      degradationPreference: "maintain-resolution",
      encoding: { maxBitrate: 7_000_000, maxFramerate: 15 },
    };
  }

  return qualities;
}

/** Pick a stored quality, falling back to one the plan still allows */
export function resolveQuality(
  qualities: Partial<Record<ScreenShareQualityName, ScreenShareQuality>>,
  name: ScreenShareQualityName | undefined,
): ScreenShareQuality {
  return (name && qualities[name]) || qualities.high || qualities.low!;
}

/** Capture options for LocalParticipant.setScreenShareEnabled */
export function captureOptions(
  quality: ScreenShareQuality,
  audio: ScreenShareCaptureOptions["audio"],
): ScreenShareCaptureOptions {
  if (!quality.width || !quality.height) {
    // source size: LiveKit drops a 0×0 resolution together with its frame
    // rate, so pass the rate as a plain constraint
    return {
      video: {
        frameRate: quality.frameRate,
      } as ScreenShareCaptureOptions["video"],
      contentHint: quality.contentHint,
      audio,
    };
  }
  return {
    resolution: {
      width: quality.width,
      height: quality.height,
      frameRate: quality.frameRate,
    },
    contentHint: quality.contentHint,
    audio,
  };
}

/** Publish options matching a quality */
export function publishOptions(
  quality: ScreenShareQuality,
  videoCodec?: VideoCodec,
): TrackPublishOptions {
  return {
    screenShareEncoding: quality.encoding,
    degradationPreference: quality.degradationPreference,
    ...(videoCodec ? { videoCodec } : {}),
  };
}

/**
 * Switch a live screen share to a quality: capture size and rate, content
 * hint, degradation preference and the sender's bitrate/frame rate caps.
 */
export async function applyQuality(
  publication: LocalTrackPublication,
  quality: ScreenShareQuality,
) {
  const track = publication.videoTrack as LocalVideoTrack | undefined;
  if (!track) return;
  // The patched applyScreenShareConstraints only recomputes the encoder
  // settings when the frame size changes. A quality with the same size but a
  // different bitrate or frame rate (or a share that already started at the
  // chosen size) would keep the old caps, so force the recompute.
  track.lastEncodedDimensions = undefined;
  // source size: the patch ignores a 0×0 resolution, so ask for the largest
  // size the capture offers
  const capabilities = track.mediaStreamTrack.getCapabilities?.();
  await track.applyScreenShareConstraints(
    {
      resolution: {
        width: quality.width || capabilities?.width?.max || 0,
        height: quality.height || capabilities?.height?.max || 0,
        frameRate: quality.frameRate,
      },
      contentHint: quality.contentHint,
    },
    quality.encoding,
  );
  await track.setDegradationPreference(quality.degradationPreference);
}

type DisplayMediaCap = { width: number; height: number; frameRate: number };

/**
 * The quality to publish with: voice-ingress removes a user from the call
 * when the video they publish has more pixels than their plan's
 * `video_resolution` (checked once, on track_published). A quality above that
 * area is scaled down (same shape, even sizes); applyQuality raises it after
 * publishing, as the client always did.
 */
export function publishSafeQuality(
  quality: ScreenShareQuality,
  limit: [number, number],
): ScreenShareQuality {
  const [limitW, limitH] = limit;
  const width = quality.width || limitW;
  const height = quality.height || limitH;
  if (!limitW || !limitH || !width || !height) return quality;
  const scale = Math.min(1, Math.sqrt((limitW * limitH) / (width * height)));
  const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
  return {
    ...quality,
    width: even(width * scale),
    height: even(height * scale),
  };
}

let cap: DisplayMediaCap | undefined;

/**
 * Hard maximum (width, height, frame rate; 0 = none) for the next
 * getDisplayMedia call, so the published size never trips the server check
 * even when the screen's shape differs from 16:9. Undefined lifts the cap.
 */
export function setDisplayMediaCap(next: DisplayMediaCap | undefined) {
  cap = next;
}

/** Clamp video constraints of a getDisplayMedia call to the current cap */
export function clampDisplayMediaOptions(
  opts: DisplayMediaStreamOptions | undefined,
): DisplayMediaStreamOptions | undefined {
  if (!cap || !opts || !opts.video) return opts;
  const video: MediaTrackConstraints =
    typeof opts.video === "object" ? { ...opts.video } : {};
  if (cap.width > 0) video.width = { ...asRange(video.width), max: cap.width };
  if (cap.height > 0)
    video.height = { ...asRange(video.height), max: cap.height };
  if (cap.frameRate > 0)
    video.frameRate = { ...asRange(video.frameRate), max: cap.frameRate };
  return { ...opts, video };
}

function asRange(
  value: ConstrainULong | ConstrainDouble | undefined,
): ConstrainULongRange | ConstrainDoubleRange {
  if (value === undefined) return {};
  return typeof value === "number" ? { ideal: value } : { ...value };
}

let installed = false;

/** Wrap navigator.mediaDevices.getDisplayMedia once with the cap */
export function installDisplayMediaCap(
  after?: (
    stream: MediaStream,
    opts: DisplayMediaStreamOptions | undefined,
  ) => Promise<MediaStream>,
) {
  if (installed || !navigator.mediaDevices?.getDisplayMedia) return;
  installed = true;
  const original = navigator.mediaDevices.getDisplayMedia;
  navigator.mediaDevices.getDisplayMedia = async function (opts) {
    const clamped = clampDisplayMediaOptions(opts);
    const stream: MediaStream = await original.call(this, clamped);
    return after ? after(stream, clamped) : stream;
  };
}

const watched = new WeakSet<Room>();
const vp8Retired = new WeakSet<Room>();

/**
 * Remember when a VP8 video stops being published in a call.
 *
 * LiveKit 1.9 never negotiates VP8 again on that connection: sharing the
 * screen a second time announced VP8, the server answered without it, the
 * browser fell back to H.264 and viewers never received the new share
 * ("could not find codec for webrtc receiver"). H.264 publishes fine any
 * number of times, so later shares use it (see republishCodec).
 */
export function watchRetiredCodecs(room: Room) {
  if (watched.has(room)) return;
  watched.add(room);
  room.on("localTrackUnpublished", (publication) => {
    if (publication.kind !== "video") return;
    const codec =
      publication.mimeType?.split("/")[1] ??
      (publication.videoTrack as LocalVideoTrack | undefined)?.codec ??
      "vp8";
    if (codec.toLowerCase() === "vp8") vp8Retired.add(room);
  });
}

/** Codec for a new screen share in this call (undefined = room default) */
export function republishCodec(room: Room): VideoCodec | undefined {
  if (!vp8Retired.has(room)) return undefined;
  const h264 = globalThis.RTCRtpSender?.getCapabilities?.("video")?.codecs.some(
    (codec) => codec.mimeType.toLowerCase() === "video/h264",
  );
  return h264 ? "h264" : undefined;
}

/** Live numbers of a screen share as it is really sent or received */
export type ScreenShareLiveStats = {
  width: number;
  height: number;
  fps: number;
  /** why the encoder sends less than asked (sender only) */
  limitation?: "bandwidth" | "cpu" | "other";
};

/** Top simulcast layer actually leaving this client */
export async function senderLiveStats(
  track: LocalVideoTrack,
): Promise<ScreenShareLiveStats | undefined> {
  const layers = await track.getSenderStats();
  const top = layers.reduce<(typeof layers)[number] | undefined>(
    (best, layer) =>
      (layer.frameWidth ?? 0) > (best?.frameWidth ?? 0) ? layer : best,
    undefined,
  );
  if (!top?.frameWidth) return;
  const reason = top.qualityLimitationReason;
  return {
    width: top.frameWidth,
    height: top.frameHeight,
    fps: Math.round(top.framesPerSecond ?? 0),
    limitation:
      reason === "bandwidth" || reason === "cpu" || reason === "other"
        ? reason
        : undefined,
  };
}

/** Short label such as "1920×1080 · 30 FPS" */
export function liveStatsLabel(stats: ScreenShareLiveStats) {
  return `${stats.width}×${stats.height} · ${stats.fps} FPS`;
}
