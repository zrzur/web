import { CONFIGURATION } from "@revolt/common";

/**
 * GIF client for the picker. The browser talks only to our own GIF service
 * (gifbox, gif.zrzur.com). It holds the KLIPY key, searches KLIPY for us and
 * serves the media files, so KLIPY never sees a reader's or sender's IP
 * address. No user id and no "this GIF was shared" report is sent anywhere.
 */
const base = () => (CONFIGURATION.DEV_GIFBOX_URL ?? "").replace(/\/+$/, "");

type Media = {
  /** KLIPY address, used only as the text of a sent message */
  url: string;
  /** signed link through our GIF service; what the browser loads */
  src?: string;
  width: number;
  height: number;
};
type Formats = Partial<Record<"gif" | "webp" | "jpg" | "mp4", Media>>;

export type KlipyGif = {
  id: number | string;
  slug: string;
  title?: string;
  file: Partial<Record<"hd" | "md" | "sm" | "xs", Formats>>;
};

export type KlipyCategory = {
  category: string;
  query: string;
  preview_url: string;
  preview_src?: string;
};

export type KlipyPage = {
  data: KlipyGif[];
  current_page: number;
  has_next: boolean;
};

/** GIFs work when the GIF service is configured */
export const klipyEnabled = () => !!base();

/** Session token that proves to our GIF service who is asking (never forwarded) */
export type GifAuth = { token?: string };

function endpoint(path: string, params: Record<string, string | number>) {
  const url = new URL(`${base()}/klipy/${path}`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  return url;
}

async function get<T>(
  url: URL,
  auth: GifAuth,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    signal,
    credentials: "omit",
    headers: auth.token ? { "X-Session-Token": auth.token } : undefined,
  });
  if (!response.ok) throw new Error(`GIF service ${response.status}`);
  const body = await response.json();
  if (body?.result === false) throw new Error("GIF service error");
  return body.data as T;
}

export function klipyCategories(
  locale: string,
  auth: GifAuth,
  signal?: AbortSignal,
) {
  return get<{ categories: KlipyCategory[] }>(
    endpoint("categories", { locale }),
    auth,
    signal,
  ).then((data) => data.categories ?? []);
}

export function klipyGifs(
  options: {
    /** search text; empty for trending */
    query: string;
    page: number;
    locale: string;
  },
  auth: GifAuth,
  signal?: AbortSignal,
) {
  return get<KlipyPage>(
    endpoint("gifs", {
      query: options.query,
      page: options.page,
      per_page: 24,
      locale: options.locale,
    }),
    auth,
    signal,
  );
}

/** What the browser may load: the signed link on our GIF service, if there is one */
export function mediaSrc(media?: { src?: string }) {
  return media?.src ? `${base()}${media.src}` : undefined;
}

/** Small animated preview for the grid */
export const previewOf = (gif: KlipyGif) =>
  gif.file.sm?.webp ?? gif.file.sm?.gif ?? gif.file.xs?.gif ?? gif.file.md?.gif;

/** Still frame shown instantly (a few KB) */
export const stillOf = (gif: KlipyGif) => gif.file.sm?.jpg;

/** Small looping video for the grid (much lighter than animated WebP/GIF) */
export const videoOf = (gif: KlipyGif) => gif.file.sm?.mp4;

/** What gets sent: a medium GIF that embeds well in chat */
export const sendUrlOf = (gif: KlipyGif) =>
  (gif.file.md?.gif ?? gif.file.hd?.gif ?? gif.file.sm?.gif)?.url;

