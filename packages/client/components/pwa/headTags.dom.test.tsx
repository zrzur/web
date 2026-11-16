import { beforeEach, describe, expect, it } from "vitest";

import { addIOSLaunchImages } from "./headTags";
import { appTitle, manifestHref, setInstallLanguage } from "./installLanguage";
import { IOS_SCREENS } from "./iosScreens";

beforeEach(() => {
  document.head.innerHTML = `
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="apple-mobile-web-app-title" content="Zrzur">`;
});

describe("install tags follow the app's language", () => {
  it("Arabic has its own manifest, every other language the default", () => {
    expect(manifestHref("/", "ar")).toBe("/manifest.ar.webmanifest");
    expect(manifestHref("/", "ar-SY")).toBe("/manifest.ar.webmanifest");
    expect(manifestHref("/", "de")).toBe("/manifest.webmanifest");
    expect(manifestHref("/", undefined)).toBe("/manifest.webmanifest");
    expect(manifestHref("/app/", "ar")).toBe("/app/manifest.ar.webmanifest");
  });

  it("the home-screen name is زرزور in Arabic, Zrzur elsewhere", () => {
    expect(appTitle("ar")).toBe("زرزور");
    expect(appTitle("en")).toBe("Zrzur");
    expect(appTitle("ru")).toBe("Zrzur");
  });

  it("switches the page's manifest and name, and back", () => {
    setInstallLanguage("ar", document, "/");
    expect(
      document.querySelector('link[rel="manifest"]')!.getAttribute("href"),
    ).toBe("/manifest.ar.webmanifest");
    expect(
      document
        .querySelector('meta[name="apple-mobile-web-app-title"]')!
        .getAttribute("content"),
    ).toBe("زرزور");

    setInstallLanguage("en", document, "/");
    expect(
      document.querySelector('link[rel="manifest"]')!.getAttribute("href"),
    ).toBe("/manifest.webmanifest");
  });

  it("links one launch image per screen, once", () => {
    addIOSLaunchImages(document, "/");
    addIOSLaunchImages(document, "/");
    const links = document.querySelectorAll(
      'link[rel="apple-touch-startup-image"]',
    );
    expect(links).toHaveLength(IOS_SCREENS.length);
    expect(links[0].getAttribute("href")).toMatch(
      /^\/assets\/web\/splash\/\d+x\d+\.png$/,
    );
  });
});
