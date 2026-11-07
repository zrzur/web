import { isProhibitedEndpoint } from "./env";

export type GifCategory = { title: string; image: string };
export type GifResult = { url: string; preview: string; video: boolean };

function httpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      !isProhibitedEndpoint(value) &&
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Never allow an unset service to turn into a request to the web app itself. */
export function gifEndpoint(base: string, path: string, query?: string) {
  if (!httpUrl(base)) throw new Error("GIF service is not configured");
  const url = new URL(`${base.replace(/\/+$/, "")}/${path}`);
  url.searchParams.set("locale", "en_US");
  if (query) url.searchParams.set("query", query);
  return url.href;
}

export async function fetchGifData(
  endpoint: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(endpoint, {
    headers,
    signal,
    redirect: "error",
  });
  if (!response.ok) throw new Error(`GIF request failed (${response.status})`);
  return response.json();
}

export function gifCategories(payload: unknown): GifCategory[] {
  if (!Array.isArray(payload))
    throw new Error("Invalid GIF categories response");
  return payload.filter(
    (item): item is GifCategory =>
      !!item &&
      typeof item.title === "string" &&
      !!item.title.trim() &&
      httpUrl(item.image),
  );
}

export function gifResults(payload: unknown): GifResult[] {
  const results = (payload as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) throw new Error("Invalid GIF search response");
  const seen = new Set<string>();
  return results.flatMap((item) => {
    if (!item || !httpUrl(item.url) || seen.has(item.url)) return [];
    const formats = item.media_formats;
    const video = formats?.tinywebm?.url ?? formats?.webm?.url;
    const preview = httpUrl(video)
      ? video
      : (formats?.tinygif?.url ?? formats?.gif?.url);
    if (!httpUrl(preview)) return [];
    seen.add(item.url);
    return [{ url: item.url, preview, video: httpUrl(video) }];
  });
}
