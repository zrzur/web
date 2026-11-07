import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchGifData,
  gifCategories,
  gifEndpoint,
  gifResults,
} from "./gifPicker";

afterEach(() => vi.unstubAllGlobals());
describe("GIF service boundaries", () => {
  it("fails closed for missing, relative, credential-bearing or executable endpoints", () => {
    for (const base of [
      "",
      "/",
      "javascript:alert(1)",
      "https://user:password@example.test",
    ]) {
      expect(() => gifEndpoint(base, "categories")).toThrow();
    }
  });
  it("preserves a configured base path and encodes Unicode search text", () => {
    const url = new URL(
      gifEndpoint("http://127.0.0.1:14720/api/", "search", "مرحبا & cats"),
    );
    expect(url.pathname).toBe("/api/search");
    expect(url.searchParams.get("query")).toBe("مرحبا & cats");
    expect(url.searchParams.get("locale")).toBe("en_US");
  });
  it("rejects HTTP errors and forwards cancellation without following redirects", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    await expect(
      fetchGifData(
        "http://localhost:14720/search",
        { "X-Test": "test" },
        controller.signal,
      ),
    ).rejects.toThrow("503");
    expect(fetcher).toHaveBeenCalledWith("http://localhost:14720/search", {
      headers: { "X-Test": "test" },
      signal: controller.signal,
      redirect: "error",
    });
  });
  it("rejects malformed service responses instead of reporting no results", () => {
    expect(() => gifCategories({ error: true })).toThrow();
    expect(() => gifResults({})).toThrow();
    expect(() => gifResults(null)).toThrow();
  });
  it("filters invalid categories and unsafe media", () => {
    expect(
      gifCategories([
        { title: "Happy", image: "https://media.test/happy.gif" },
        { title: "", image: "https://media.test/a" },
        { title: "Unsafe", image: "javascript:alert(1)" },
      ]),
    ).toHaveLength(1);
    expect(
      gifResults({
        results: [
          { url: "javascript:alert(1)", media_formats: {} },
          {
            url: "https://gifs.test/1",
            media_formats: { tinywebm: { url: "data:text/html,test" } },
          },
        ],
      }),
    ).toEqual([]);
  });
  it("supports video/image previews, deduplicates results and tolerates broken individual items", () => {
    const video = {
      url: "https://gifs.test/1",
      media_formats: { tinywebm: { url: "https://media.test/1.webm" } },
    };
    const image = {
      url: "https://gifs.test/2",
      media_formats: { tinygif: { url: "https://media.test/2.gif" } },
    };
    expect(
      gifResults({
        results: [
          null,
          video,
          video,
          image,
          { url: "https://gifs.test/broken" },
        ],
      }),
    ).toEqual([
      { url: video.url, preview: "https://media.test/1.webm", video: true },
      { url: image.url, preview: "https://media.test/2.gif", video: false },
    ]);
    expect(gifResults({ results: [] })).toEqual([]);
  });
});
