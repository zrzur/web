import { describe, expect, it } from "vitest";

import { proxiedImageURL } from "../../../../stoat.js/src/solid/lib/proxy";

const PROXY = "https://proxy.zrzur.com";
const MEDIA = "https://cdn.zrzur.com";

describe("proxiedImageURL", () => {
  it("sends outside images through the proxy", () => {
    expect(proxiedImageURL("https://evil.example/t.png?u=1", PROXY, MEDIA)).toBe(
      "https://proxy.zrzur.com/proxy?url=https%3A%2F%2Fevil.example%2Ft.png%3Fu%3D1",
    );
  });

  it("never loads an outside image directly when there is no proxy", () => {
    expect(proxiedImageURL("https://evil.example/t.png", undefined, MEDIA)).toBe(
      undefined,
    );
  });

  it("loads the server's own files as they are", () => {
    expect(proxiedImageURL("https://cdn.zrzur.com/avatars/abc", undefined, MEDIA)).toBe(
      "https://cdn.zrzur.com/avatars/abc",
    );
    // a look-alike host is not the server's own
    expect(
      proxiedImageURL("https://cdn.zrzur.com.evil.example/x", undefined, MEDIA),
    ).toBe(undefined);
  });

  it("refuses anything that is not a web address", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:image/svg+xml,<svg onload=alert(1)>",
      "file:///etc/passwd",
      "//evil.example/x.png",
      "/relative.png",
      "https://exa mple.com/x.png",
      "https:///x",
    ])
      expect(proxiedImageURL(url, PROXY, MEDIA), url).toBe(undefined);
  });
});
