import { afterEach, describe, expect, it, vi } from "vitest";

import { browserPreferredLanguage, importCatalog } from "./catalog";
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
});
