import { i18n } from "@lingui/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  browserPreferredLanguage,
  importCatalog,
  preferSiteCatalogs,
  setFullCatalogLoader,
} from "./catalog";
import { Language } from "./Languages";

// these tests import a whole language catalog (a large module); in a full,
// parallel run that alone can take longer than the 5 s default, so they get
// the time their own waits already allow
const FULL_IMPORT_MS = 30_000;

describe("message catalogs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts one download per language, shared by the early start and the provider", async () => {
    const early = importCatalog(Language.GERMAN);
    const later = importCatalog(Language.GERMAN);
    expect(later).toBe(early);
    const messages = await early;
    expect(Object.keys(messages).length).toBeGreaterThan(100);
  });

  it("tries again after a failed download", async () => {
    const broken = "xx-broken" as Language;
    const first = importCatalog(broken);
    await expect(first).rejects.toBeTruthy();
    const second = importCatalog(broken);
    expect(second).not.toBe(first);
    await expect(second).rejects.toBeTruthy();
  });

  it("picks the device language, exact match first", () => {
    // an exact match anywhere in the list wins over a partial one
    vi.stubGlobal("navigator", { languages: ["de-AT", "ar"] });
    expect(browserPreferredLanguage()).toBe(Language.ARABIC);
    vi.stubGlobal("navigator", { languages: ["de-AT"] });
    expect(browserPreferredLanguage()).toBe(Language.GERMAN);
    vi.stubGlobal("navigator", { languages: ["en-US"] });
    expect(browserPreferredLanguage()).toBe(Language.ENGLISH_STUPEFIED);
    vi.stubGlobal("navigator", { languages: ["xx"] });
    expect(browserPreferredLanguage()).toBe(Language.ENGLISH);
  });

  it("gives a Chinese device the Simplified Chinese text", () => {
    // browsers report a region (zh-CN) or the bare language, never "zh-Hans"
    for (const reported of ["zh-CN", "zh", "zh-SG", "zh-Hans-CN"]) {
      vi.stubGlobal("navigator", { languages: [reported, "en"] });
      expect(browserPreferredLanguage()).toBe(Language.CHINESE_SIMPLIFIED);
    }
    // Traditional Chinese is not translated yet: the next language in the list is used
    vi.stubGlobal("navigator", { languages: ["zh-TW", "de"] });
    expect(browserPreferredLanguage()).toBe(Language.GERMAN);
  });

  it("on the Discover and Designs sites, shows the small file first and adds the full one after", async () => {
    const load = vi.spyOn(i18n, "load").mockImplementation(() => undefined);
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ only: ["Nur das"] }),
    }));
    vi.stubGlobal("fetch", fetch);
    preferSiteCatalogs({ ar: "/assets/site-messages-ar.json" });

    const first = await importCatalog(Language.ARABIC);
    expect(first).toEqual({ only: ["Nur das"] });
    expect(fetch).toHaveBeenCalledWith("/assets/site-messages-ar.json");

    // the full file is a real import of a large module
    await vi.waitFor(() => expect(load).toHaveBeenCalled(), {
      timeout: 20_000,
    });
    const [locale, full] = load.mock.calls[0] as unknown as [string, object];
    expect(locale).toBe(Language.ARABIC);
    expect(Object.keys(full).length).toBeGreaterThan(100);
    load.mockRestore();
  }, FULL_IMPORT_MS);

  it("falls back to the full file when the small one fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    preferSiteCatalogs({ en: "/assets/site-messages-en.json" });
    const messages = await importCatalog(Language.ENGLISH);
    expect(Object.keys(messages).length).toBeGreaterThan(100);
  }, FULL_IMPORT_MS);

  it("tries the full file again on the next ask after it failed", async () => {
    const load = vi.spyOn(i18n, "load").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ s: ["S"] }) })),
    );
    let calls = 0;
    setFullCatalogLoader(async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return { full: ["Voll"] };
    });
    preferSiteCatalogs({ fr: "/assets/site-messages-fr.json" });
    // a language no other test has loaded
    await importCatalog(Language.FRENCH);
    await vi.waitFor(() => expect(calls).toBe(1), { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 10));
    expect(load).not.toHaveBeenCalled();

    await importCatalog(Language.FRENCH);
    await vi.waitFor(
      () => expect(load).toHaveBeenCalledWith("fr", { full: ["Voll"] }),
      { timeout: 5000 },
    );
    expect(calls).toBe(2);
    load.mockRestore();
    setFullCatalogLoader();
  }, FULL_IMPORT_MS);

  it("on the sites, asks for the full file only once the page has loaded", async () => {
    const load = vi.spyOn(i18n, "load").mockImplementation(() => undefined);
    const page = new EventTarget();
    vi.stubGlobal("window", page);
    vi.stubGlobal("document", { readyState: "interactive" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ s: ["S"] }) })),
    );
    let calls = 0;
    setFullCatalogLoader(async () => {
      calls++;
      return { full: ["Alles"] };
    });
    preferSiteCatalogs({ es: "/assets/site-messages-es.json" });
    // a language no other test has loaded
    await importCatalog(Language.SPANISH);
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toBe(0);

    page.dispatchEvent(new Event("load"));
    // and a moment after it, not at once
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toBe(0);
    await vi.waitFor(
      () => expect(load).toHaveBeenCalledWith("es", { full: ["Alles"] }),
      { timeout: 5000 },
    );
    expect(calls).toBe(1);
    load.mockRestore();
    setFullCatalogLoader();
  }, FULL_IMPORT_MS);
});
