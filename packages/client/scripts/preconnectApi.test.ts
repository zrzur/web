import { describe, expect, it } from "vitest";

import { preconnectApi, preconnectOrigin } from "./preconnectApi.mjs";

describe("preconnectOrigin", () => {
  it("is the API's origin when it is on another host", () => {
    expect(preconnectOrigin("https://api.zrzur.com", "app.zrzur.com")).toBe(
      "https://api.zrzur.com",
    );
    expect(
      preconnectOrigin("https://api.zrzur.com/some/path?x=1", "app.zrzur.com"),
    ).toBe("https://api.zrzur.com");
    expect(preconnectOrigin("http://127.0.0.1:14702", "127.0.0.1:31400")).toBe(
      "http://127.0.0.1:14702",
    );
  });

  it("keeps the build placeholder that docker/inject.js replaces", () => {
    expect(preconnectOrigin("__VITE_API_URL__", "__VITE_HOST__")).toBe(
      "__VITE_API_URL__",
    );
    const plugin = preconnectApi({
      apiUrl: "__VITE_API_URL__",
      host: "__VITE_HOST__",
    });
    expect(plugin.transformIndexHtml()[0].attrs.href).toBe("__VITE_API_URL__");
  });

  it("is nothing for the app's own host, a relative address or no address", () => {
    expect(preconnectOrigin("https://app.zrzur.com", "app.zrzur.com")).toBe(
      undefined,
    );
    expect(preconnectOrigin("/api", "app.zrzur.com")).toBe(undefined);
    expect(preconnectOrigin(undefined, "app.zrzur.com")).toBe(undefined);
    expect(preconnectOrigin("", "app.zrzur.com")).toBe(undefined);
    expect(preconnectOrigin("ftp://api.zrzur.com", "app.zrzur.com")).toBe(
      undefined,
    );
  });
});

describe("preconnectApi", () => {
  it("puts one anonymous preconnect link first in the head", () => {
    const plugin = preconnectApi({
      apiUrl: "https://api.zrzur.com",
      host: "app.zrzur.com",
    });
    expect(plugin.transformIndexHtml()).toEqual([
      {
        tag: "link",
        attrs: {
          rel: "preconnect",
          href: "https://api.zrzur.com",
          crossorigin: "",
        },
        injectTo: "head-prepend",
      },
    ]);
  });

  it("adds nothing when the API is on the app's host", () => {
    const plugin = preconnectApi({ apiUrl: "/api", host: "app.zrzur.com" });
    expect(plugin.transformIndexHtml()).toEqual([]);
  });
});
