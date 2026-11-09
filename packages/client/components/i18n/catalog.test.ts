import { i18n } from "@lingui/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  browserPreferredLanguage,
  importCatalog,
  preferSiteCatalogs,
} from "./catalog";
import { Language } from "./Languages";

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

    await vi.waitFor(() => expect(load).toHaveBeenCalled());
    const [locale, full] = load.mock.calls[0] as unknown as [string, object];
    expect(locale).toBe(Language.ARABIC);
    expect(Object.keys(full).length).toBeGreaterThan(100);
    load.mockRestore();
  });

  it("falls back to the full file when the small one fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    preferSiteCatalogs({ en: "/assets/site-messages-en.json" });
    const messages = await importCatalog(Language.ENGLISH);
    expect(Object.keys(messages).length).toBeGreaterThan(100);
  });
});
