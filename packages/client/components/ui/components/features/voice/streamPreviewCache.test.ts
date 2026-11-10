import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PREVIEW_FRESH_MS,
  clearPreviews,
  previewOf,
} from "./streamPreviewCache";

beforeEach(() => clearPreviews());

describe("stream preview cache", () => {
  it("asks once while a still is fresh, again after 30 seconds", async () => {
    const fetch = vi.fn(async () => "data:image/jpeg;base64,AAAA");
    expect(await previewOf("vc", "sharer", fetch, 1_000)).toBe(
      "data:image/jpeg;base64,AAAA",
    );
    await previewOf("vc", "sharer", fetch, 1_000 + PREVIEW_FRESH_MS - 1);
    expect(fetch).toHaveBeenCalledOnce();
    await previewOf("vc", "sharer", fetch, 1_000 + PREVIEW_FRESH_MS);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps each share apart", async () => {
    const fetch = vi.fn(async () => "data:x");
    await previewOf("vc", "a", fetch, 0);
    await previewOf("vc", "b", fetch, 0);
    await previewOf("other", "a", fetch, 0);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does not remember that there was no still", async () => {
    const fetch = vi
      .fn<() => Promise<string | undefined>>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue("data:x");
    expect(await previewOf("vc", "late", fetch, 0)).toBeUndefined();
    expect(await previewOf("vc", "late", fetch, 1)).toBe("data:x");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("a failed fetch shows nothing instead of throwing", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("NotFound");
    });
    expect(await previewOf("vc", "a", fetch, 0)).toBeUndefined();
  });
});
