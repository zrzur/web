import { createSignal } from "solid-js";

/**
 * "Save data": for people whose mobile internet is weak or paid by the
 * megabyte. One switch, kept on this device only (a phone on mobile data and
 * a computer on a home line want different answers), never synced.
 *
 * What it changes is decided here, in plain functions, so every screen asks
 * the same questions and the answers can be tested without a browser:
 *
 * - pictures over `SMALL_PICTURE_BYTES`, every GIF and every video wait for
 *   a tap; nothing of them is downloaded before it
 * - sound and video players fetch nothing until Play
 * - link previews keep their words; their pictures wait for a tap
 * - avatars, icons and banners are asked for as the media server's preview,
 *   never as the animated original
 * - decorations, nameplates and profile effects stay still
 * - code of screens that were not opened is not fetched ahead
 * - voice is sent at `SAVE_DATA_VOICE_BITRATE`, and other people's cameras
 *   and screens wait for a tap
 *
 * A media server that makes small previews says so in its greeting (see
 * `learnSmallPreviews`). Then every picture and GIF shows as its small still
 * preview and the ordinary one loads on a tap, and avatars, icons, banners
 * and custom emoji come small too. On a server without them, a large picture
 * is held back whole instead.
 */

const KEY = "zrzur:save-data";
const OFFERED_KEY = "zrzur:save-data-offered";

/** What `navigator.connection` tells us, where the browser has it */
export type ConnectionHints = { saveData?: boolean; effectiveType?: string };

function read(key: string) {
  try {
    return globalThis.localStorage?.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, value: boolean) {
  try {
    globalThis.localStorage?.setItem(key, value ? "1" : "0");
  } catch {
    // storage blocked: the choice lasts until the page closes
  }
}

const [on, setOn] = createSignal(read(KEY));

/** Whether Save data is on for this device (reactive) */
export const saveData = on;

/** Turn Save data on or off on this device */
export function setSaveData(value: boolean) {
  setOn(value);
  write(KEY, value);
}

/** The browser's own hints, if it gives any */
export function connectionHints(): ConnectionHints | undefined {
  return (
    globalThis.navigator as
      | (Navigator & { connection?: ConnectionHints })
      | undefined
  )?.connection;
}

/**
 * Whether the device itself asks for less data: its data saver is on, or the
 * browser rates the connection as 2G. A slow line is a reason to offer the
 * mode, never to switch it on for someone.
 */
export function connectionAsksToSave(connection?: ConnectionHints) {
  if (!connection) return false;
  return (
    !!connection.saveData || /(^|-)2g$/.test(connection.effectiveType ?? "")
  );
}

/**
 * Whether to offer the mode now: only when the device asks for less data,
 * the mode is off, and the offer was not made before on this device.
 */
export function shouldOfferSaveData(input: {
  on: boolean;
  offered: boolean;
  connection?: ConnectionHints;
}) {
  return !input.on && !input.offered && connectionAsksToSave(input.connection);
}

/** Whether the one-time offer was already shown on this device */
export const saveDataOffered = () => read(OFFERED_KEY);

/** The offer was shown: whatever the answer, it is not made again */
export function markSaveDataOffered() {
  write(OFFERED_KEY, true);
}

/**
 * A picture this small loads by itself even with Save data on: holding it
 * back would cost a tap to save almost nothing.
 */
export const SMALL_PICTURE_BYTES = 150_000;

/** What a piece of media is, for the words on its placeholder */
export type HeldKind = "picture" | "gif";

/** Whether an uploaded picture moves (the server keeps animated files whole) */
export function isAnimatedPicture(file: {
  contentType?: string;
  metadata?: { type?: string; animated?: boolean | null };
}) {
  return (
    file.contentType === "image/gif" ||
    file.contentType === "image/apng" ||
    file.metadata?.animated === true
  );
}

/**
 * Whether an uploaded picture waits for a tap.
 * @param saving Save data is on
 * @param file Its type and the size of the uploaded file, if known
 */
export function holdsPicture(
  saving: boolean,
  file: {
    size?: number;
    contentType?: string;
    metadata?: { type?: string; animated?: boolean | null };
  },
) {
  if (!saving) return false;
  if (isAnimatedPicture(file)) return true;
  // unknown size: assume it is not small
  return !(typeof file.size === "number" && file.size <= SMALL_PICTURE_BYTES);
}

/**
 * Whether a picture, GIF or video from another site (a link preview) waits
 * for a tap. Their size is not known before the download, so all of them do.
 */
export function holdsLinkMedia(saving: boolean) {
  return saving;
}

/** How much a sound or video player fetches before Play */
export function mediaPreload(saving: boolean): "none" | "metadata" {
  return saving ? "none" : "metadata";
}

/**
 * Whether the animated original of an avatar, icon or banner may be asked
 * for. With Save data on the preview is used instead; for avatars and icons
 * the server answers with one still frame.
 */
export function allowsAnimatedOriginal(saving: boolean) {
  return !saving;
}

/** Whether code and screens that were not asked for may be fetched ahead */
export function allowsLoadingAhead(saving: boolean) {
  return !saving;
}

/**
 * Opus bitrate of the microphone with Save data on. 24 kbps mono is clear
 * speech (Opus "wideband"); the usual 64 kbps is kept for everyone else.
 */
export const SAVE_DATA_VOICE_BITRATE = 24_000;

/** The bitrate a call sends at, lowered when saving */
export function voiceBitrateWhenSaving(saving: boolean, bitrate: number) {
  return saving ? Math.min(bitrate, SAVE_DATA_VOICE_BITRATE) : bitrate;
}

/**
 * Whether another person's camera or screen share waits for a tap before
 * anything of it is received.
 */
export function holdsRemoteVideo(saving: boolean) {
  return saving;
}

/** Human size for a placeholder: "480 KB", "2.3 MB" (digits stay Western) */
export function shortSize(bytes?: number) {
  if (!bytes || bytes <= 0) return undefined;
  if (bytes >= 1_000_000) {
    const mb = bytes / 1_000_000;
    return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
  }
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

/**
 * The things one tap has already loaded, so a message drawn again (scrolling
 * away and back) does not ask twice. Kept until the page closes.
 */
const [loaded, setLoaded] = createSignal<ReadonlySet<string>>(new Set());

/** Whether this item was loaded by a tap in this visit */
export const wasLoadedByTap = (key?: string) => !!key && loaded().has(key);

/** Remember that a tap loaded this item */
export function markLoadedByTap(key?: string) {
  if (key && !loaded().has(key)) setLoaded(new Set([...loaded(), key]));
}

const SMALL_KEY = "zrzur:small-previews";

/**
 * The media server that is known to make small previews (its address), kept
 * from the last visit so the first screen does not wait for the question.
 */
function readSmall() {
  try {
    return globalThis.localStorage?.getItem(SMALL_KEY) ?? "";
  } catch {
    return "";
  }
}

const [smallAt, setSmallAt] = createSignal(readSmall());

/**
 * Whether this media server makes small previews (`?size=small`: 480 px for
 * an attachment, 96 px for an avatar, always one still frame). Reactive.
 */
export const smallPreviews = (mediaUrl?: string) =>
  !!mediaUrl && smallAt() === mediaUrl;

/** Media servers already asked in this visit */
const asked = new Set<string>();

/**
 * Ask the media server once per visit whether it makes small previews (its
 * greeting, some hundred bytes). An old server does not say so, and is never
 * asked for one: it would answer a GIF's small preview with the whole GIF.
 */
export async function learnSmallPreviews(
  mediaUrl: string | undefined,
  get: (url: string) => Promise<unknown> = (url) =>
    fetch(url).then((response) => response.json()),
) {
  if (!mediaUrl || asked.has(mediaUrl)) return;
  asked.add(mediaUrl);
  let makes = false;
  try {
    const hello = (await get(`${mediaUrl}/`)) as { small_previews?: unknown };
    makes = hello?.small_previews === true;
  } catch {
    // unreachable now: keep what the last visit knew
    return;
  }
  if (makes) setSmallAt(mediaUrl);
  else if (smallAt() === mediaUrl) setSmallAt("");
  try {
    globalThis.localStorage?.setItem(SMALL_KEY, smallAt());
  } catch {
    // storage blocked: known until the page closes
  }
}

/**
 * The small preview of a media server's preview address. Only a plain
 * preview address gets it: an original, a named file or an address that
 * already carries a query is returned as it is.
 */
export function smallPreviewUrl(previewUrl: string) {
  const path = previewUrl.replace(/^https?:\/\/[^/]+/, "");
  if (!/^(\/[\w.-]+)*\/[a-z]+\/[\w-]+$/.test(path)) return previewUrl;
  if (path.endsWith("/original")) return previewUrl;
  return `${previewUrl}?size=small`;
}

/** How an uploaded picture is shown */
export type PictureShown =
  /** as always */
  | "full"
  /** its small still preview, the ordinary one on a tap */
  | "small"
  /** a placeholder with its size, the ordinary one on a tap */
  | "held";

/**
 * How an uploaded picture or GIF is shown.
 * @param saving Save data is on
 * @param small The media server makes small previews
 */
export function pictureShown(
  saving: boolean,
  small: boolean,
  file: Parameters<typeof holdsPicture>[1],
): PictureShown {
  if (!saving) return "full";
  if (small) return "small";
  return holdsPicture(saving, file) ? "held" : "full";
}

type FileLike = {
  tag?: string;
  createFileURL(forceAnimation?: boolean): string | undefined;
};

/** Kinds of file whose every use may be the small preview while saving */
const SMALL_EVERYWHERE = new Set(["avatars", "icons", "banners"]);

/**
 * Every avatar, icon and banner address in the app comes from the SDK's
 * `File.createFileURL`; its `forceAnimation` asks for the animated original.
 * Wrapped once here, that request is dropped while Save data is on, so the
 * hundred places that show an animated avatar need no change of their own.
 * Reading the switch inside keeps every address reactive.
 *
 * Where the media server makes small previews, avatars, icons and banners
 * are asked for small as well (96 px and 640 px instead of 256 and 1920).
 * Attachments are not touched here: a message decides for each picture.
 * @returns Undo (for tests)
 */
export function stillFileUrlsWhenSaving(prototype: FileLike) {
  const original = prototype.createFileURL;
  prototype.createFileURL = function (
    this: FileLike,
    forceAnimation?: boolean,
  ) {
    const saving = saveData();
    const url = original.call(
      this,
      forceAnimation && allowsAnimatedOriginal(saving),
    );
    if (!saving || !url || !SMALL_EVERYWHERE.has(this.tag ?? "")) return url;
    // the media server's address is the part before "/<tag>/"
    const mediaUrl = url.slice(0, url.lastIndexOf(`/${this.tag}/`));
    return smallPreviews(mediaUrl) ? smallPreviewUrl(url) : url;
  };
  return () => {
    prototype.createFileURL = original;
  };
}
