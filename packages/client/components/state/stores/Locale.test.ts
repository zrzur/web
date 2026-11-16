import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/i18n", () => ({
  Language: { ENGLISH: "en" },
  Languages: { en: {}, fr: {}, "zh-Hans": {} },
  browserPreferredLanguage: () => "en",
  loadAndSwitchLocale: vi.fn(async () => undefined),
}));
vi.mock("@revolt/i18n/dayjs", () => ({ updateTimeLocaleOptions: vi.fn() }));

import { Locale, TypeLocale } from "./Locale";

function makeStore(initial: TypeLocale) {
  const box = { locale: initial };
  const state = {
    get: () => box.locale,
    set: (_key: string, field: keyof TypeLocale, value: never) => {
      box.locale = { ...box.locale, [field]: value };
    },
  };
  return new Locale(state as never);
}

describe("the desktop app's own words", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("are told the saved language, and every later choice", () => {
    const set = vi.fn();
    vi.stubGlobal("window", { desktopConfig: { set } });
    const locale = makeStore({ lang: "fr" as never, options: {} });
    locale.hydrate();
    expect(set).toHaveBeenLastCalledWith({ language: "fr" });
    locale.switch("zh-Hans" as never);
    expect(set).toHaveBeenLastCalledWith({ language: "zh-Hans" });
  });

  it("are not told a language shown for one visit only", () => {
    const set = vi.fn();
    vi.stubGlobal("window", { desktopConfig: { set } });
    const locale = makeStore({ lang: "fr" as never, options: {} });
    locale.switchForSession("en" as never);
    expect(set).not.toHaveBeenCalled();
  });

  it("change nothing in a browser, and a failing shell does not stop the switch", () => {
    vi.stubGlobal("window", {});
    expect(() =>
      makeStore({ lang: "fr" as never, options: {} }).hydrate(),
    ).not.toThrow();
    vi.stubGlobal("window", {
      desktopConfig: {
        set: () => {
          throw new Error("old shell");
        },
      },
    });
    expect(() =>
      makeStore({ lang: "fr" as never, options: {} }).hydrate(),
    ).not.toThrow();
  });
});
