import { describe, expect, it } from "vitest";

import { desktopScheme } from "./desktopScheme";
import {
  SITE_LANGUAGES,
  linkLanguage,
  reportPrefix,
  siteLanguage,
} from "./siteLanguages";

describe("desktopScheme", () => {
  it("uses zrzur-beta for the beta app and zrzur otherwise", () => {
    expect(desktopScheme("https://beta.zrzur.com")).toBe("zrzur-beta");
    expect(desktopScheme("https://app.zrzur.com")).toBe("zrzur");
    expect(desktopScheme("")).toBe("zrzur");
  });
});

describe("SITE_LANGUAGES", () => {
  it("offers the website's seven languages, in its order and own names", () => {
    expect(SITE_LANGUAGES.map((l) => [l.id, l.name])).toEqual([
      ["en", "English"],
      ["de", "Deutsch"],
      ["ar", "العربية"],
      ["fr", "Français"],
      ["es", "Español"],
      ["ru", "Русский"],
      ["zh-Hans", "简体中文"],
    ]);
  });

  it("finds a language by the app's locale, English otherwise", () => {
    expect(siteLanguage("zh-Hans").id).toBe("zh-Hans");
    expect(siteLanguage("ru").name).toBe("Русский");
    expect(siteLanguage("ja").id).toBe("en");
    expect(siteLanguage(undefined).id).toBe("en");
  });
});

describe("linkLanguage", () => {
  it("reads ?hl= for each of the seven languages", () => {
    for (const { id } of SITE_LANGUAGES)
      expect(linkLanguage(`?hl=${encodeURIComponent(id)}`)).toBe(id);
    expect(linkLanguage("?q=x&hl=fr")).toBe("fr");
  });

  it("takes the website's short zh for Simplified Chinese", () => {
    expect(linkLanguage("?hl=zh")).toBe("zh-Hans");
  });

  it("ignores languages the sites do not offer", () => {
    expect(linkLanguage("?hl=ja")).toBeUndefined();
    expect(linkLanguage("?hl=zh-Hant")).toBeUndefined();
    expect(linkLanguage("")).toBeUndefined();
  });
});

describe("reportPrefix", () => {
  it("uses the website's language folders", () => {
    expect(reportPrefix("en")).toBe("");
    expect(reportPrefix("ar")).toBe("/ar");
    expect(reportPrefix("de")).toBe("/de");
    expect(reportPrefix("fr")).toBe("/fr");
    expect(reportPrefix("es")).toBe("/es");
    expect(reportPrefix("ru")).toBe("/ru");
    expect(reportPrefix("zh-Hans")).toBe("/zh");
    expect(reportPrefix("ja")).toBe("");
    expect(reportPrefix(undefined)).toBe("");
  });
});
