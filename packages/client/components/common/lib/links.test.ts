import { describe, expect, it } from "vitest";

import { DOWNLOAD_PAGE_URL } from "./links";

describe("links", () => {
  it("sends people to the download page on the zrzur.com website", () => {
    // zrzur.cc only carries invite and share links
    expect(new URL(DOWNLOAD_PAGE_URL).origin).toBe("https://zrzur.com");
    expect(new URL(DOWNLOAD_PAGE_URL).pathname).toBe("/download");
  });
});
