import { describe, expect, it } from "vitest";

import {
  OFFLINE_HEADERS,
  OFFLINE_TEXT,
  offlineLanguage,
  offlineLocale,
  offlinePage,
} from "./offlinePage";

describe("offline page", () => {
  it("has the three lines in every language of the app", () => {
    expect(Object.keys(OFFLINE_TEXT).sort()).toEqual(
      ["ar", "de", "en", "es", "fr", "ru", "zh"].sort(),
    );
    for (const text of Object.values(OFFLINE_TEXT)) {
      expect(text.title).toBeTruthy();
      expect(text.body).toBeTruthy();
      expect(text.retry).toBeTruthy();
    }
  });

  it("picks the first language of the device that it has", () => {
    expect(offlineLanguage(["ar-SY", "en"])).toBe("ar");
    expect(offlineLanguage(["tr", "de-AT"])).toBe("de");
    expect(offlineLanguage(["zh-Hans-CN"])).toBe("zh");
    expect(offlineLanguage(["tr"])).toBe("en");
    expect(offlineLanguage([])).toBe("en");
  });

  it("takes a language code from the app and nothing else", () => {
    expect(offlineLocale("ar")).toBe("ar");
    expect(offlineLocale("zh-Hans")).toBe("zh-Hans");
    expect(offlineLocale("<script>")).toBeUndefined();
    expect(offlineLocale("a".repeat(40))).toBeUndefined();
    expect(offlineLocale(42)).toBeUndefined();
    expect(offlineLocale(undefined)).toBeUndefined();
  });

  it("is right to left in Arabic only", () => {
    expect(offlinePage(["ar"])).toContain('<html lang="ar" dir="rtl">');
    expect(offlinePage(["de"])).toContain('<html lang="de" dir="ltr">');
  });

  it("runs no script and loads nothing", () => {
    const page = offlinePage(["en"]);
    expect(page).not.toMatch(/<script|src=|url\(|@import|https?:/i);
    expect(OFFLINE_HEADERS["content-security-policy"]).toContain(
      "default-src 'none'",
    );
    expect(OFFLINE_HEADERS["cache-control"]).toBe("no-store");
  });

  it("asks again by itself and by a link to the same address", () => {
    const page = offlinePage(["en"]);
    expect(page).toContain('<meta http-equiv="refresh" content="8">');
    expect(page).toContain('<a href="">Try again</a>');
  });

  it("never says Stoat or Revolt", () => {
    for (const lang of Object.keys(OFFLINE_TEXT))
      expect(offlinePage([lang])).not.toMatch(/stoat|revolt/i);
  });
});
