import { describe, expect, it } from "vitest";

import {
  docsLinkFromApp,
  pageOfPath,
  resolveDocsHref,
  siteAddress,
} from "./links";

const app = { base: "/developers/docs", appOrigin: "https://app.zrzur.com" };
const site = { base: "", appOrigin: "https://app.zrzur.com" };

describe("documentation links", () => {
  it("stay as written inside the app", () => {
    for (const href of [
      "/developers/docs/gateway#resume",
      "/developers/docs",
      "/developers",
      "https://zrzur.com/legal/terms",
      "#anchor",
    ])
      expect(resolveDocsHref(href, app)).toBe(href);
  });

  it("lose the app prefix on the standalone site", () => {
    expect(resolveDocsHref("/developers/docs/gateway#resume", site)).toBe(
      "/gateway#resume",
    );
    expect(resolveDocsHref("/developers/docs", site)).toBe("/");
    expect(resolveDocsHref("/developers/docs#top", site)).toBe("/#top");
  });

  it("name the front page of the site for the overview, never /overview", () => {
    expect(resolveDocsHref("/developers/docs/overview", site)).toBe("/");
    expect(resolveDocsHref("/developers/docs/overview#base-urls", site)).toBe(
      "/#base-urls",
    );
    // a page whose name only starts the same way keeps its name
    expect(resolveDocsHref("/developers/docs/overview-of-x", site)).toBe(
      "/overview-of-x",
    );
    expect(resolveDocsHref("/developers/docs/overview", app)).toBe(
      "/developers/docs/overview",
    );
    expect(
      docsLinkFromApp(
        "/developers/docs/overview#status",
        "https://developers.zrzur.com",
      ).href,
    ).toBe("https://developers.zrzur.com/#status");
  });

  it("send the Developer Portal to the app from the site", () => {
    expect(resolveDocsHref("/developers", site)).toBe(
      "https://app.zrzur.com/developers",
    );
  });

  it("leave files and other paths alone on the site", () => {
    expect(resolveDocsHref("/developers/api-changelog.xml", site)).toBe(
      "/developers/api-changelog.xml",
    );
    expect(resolveDocsHref("/developers-club", site)).toBe("/developers-club");
    expect(resolveDocsHref("https://zrzur.com", site)).toBe(
      "https://zrzur.com",
    );
  });

  it("read the page from the address, in the app and on the site", () => {
    expect(pageOfPath("/developers/docs/gateway", "/developers/docs")).toBe(
      "gateway",
    );
    expect(pageOfPath("/developers/docs", "/developers/docs")).toBeUndefined();
    expect(pageOfPath("/gateway", "")).toBe("gateway");
    expect(pageOfPath("/", "")).toBeUndefined();
  });
});

describe("from the app to the documentation site", () => {
  it("opens the site when there is one", () => {
    expect(
      docsLinkFromApp(
        "/developers/docs/commands#register",
        "https://developers.zrzur.com/",
      ),
    ).toEqual({
      href: "https://developers.zrzur.com/commands#register",
      external: true,
    });
    expect(
      docsLinkFromApp("/developers/docs", "https://developers.zrzur.com"),
    ).toEqual({ href: "https://developers.zrzur.com/", external: true });
  });

  it("keeps the in-app page without a site (self-hosted)", () => {
    expect(docsLinkFromApp("/developers/docs/oauth2", undefined)).toEqual({
      href: "/developers/docs/oauth2",
      external: false,
    });
  });

  it("forwards an old in-app address: same page, anchor and language", () => {
    expect(
      siteAddress("https://developers.zrzur.com", {
        pathname: "/developers/docs/gateway",
        search: "?hl=ar&x=1",
        hash: "#resume",
      }),
    ).toBe("https://developers.zrzur.com/gateway?hl=ar#resume");
    expect(
      siteAddress("https://developers.zrzur.com/", {
        pathname: "/developers/docs",
        search: "",
        hash: "",
      }),
    ).toBe("https://developers.zrzur.com/");
  });
});
