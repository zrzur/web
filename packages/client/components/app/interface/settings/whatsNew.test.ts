import { describe, expect, it } from "vitest";

import { whatsNewUrl } from "./whatsNew";

describe("What's New opens the blog in the app's language", () => {
  it("uses the website's language when it has one", () => {
    expect(whatsNewUrl("ar")).toBe("https://zrzur.com/ar/blog");
    expect(whatsNewUrl("de")).toBe("https://zrzur.com/de/blog");
    expect(whatsNewUrl("zh-Hans")).toBe("https://zrzur.com/zh/blog");
  });

  it("falls back to the English blog", () => {
    expect(whatsNewUrl("en-GB")).toBe("https://zrzur.com/blog");
    expect(whatsNewUrl("tr")).toBe("https://zrzur.com/blog");
    expect(whatsNewUrl("")).toBe("https://zrzur.com/blog");
    expect(whatsNewUrl()).toBe("https://zrzur.com/blog");
  });
});
