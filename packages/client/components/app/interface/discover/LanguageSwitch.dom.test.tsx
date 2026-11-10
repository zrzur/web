import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/i18n", () => ({ Language: {} }));
vi.mock("@revolt/common/lib/brandMark", () => ({ brandMarkSrc: () => "" }));
vi.mock("@revolt/common/lib/buildInfo", () => ({ SOURCE_CODE_URL: "" }));

const switched: string[] = [];
const state = {
  locale: {
    switch: (id: string) => {
      switched.push(id);
      i18n.loadAndActivate({ locale: id, messages: {} });
    },
  },
};
vi.mock("@revolt/state", () => ({ useState: () => state }));

import { LanguageSwitch } from "./SiteFrame";

let dispose: (() => void) | undefined;

function mount() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <LanguageSwitch />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const button = () =>
  document.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')!;
const options = () => [
  ...document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
];

beforeEach(() => {
  switched.length = 0;
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
});
afterEach(() => dispose?.());

describe("the language menu of Discover and Designs", () => {
  it("lists the website's seven languages by their own names", () => {
    mount();
    button().click();
    expect(options().map((o) => o.textContent)).toEqual([
      "English",
      "Deutsch",
      "العربية",
      "Français",
      "Español",
      "Русский",
      "简体中文",
    ]);
    expect(options().map((o) => o.lang)).toEqual([
      "en",
      "de",
      "ar",
      "fr",
      "es",
      "ru",
      "zh-Hans",
    ]);
    expect(
      options().filter((o) => o.getAttribute("aria-selected") === "true"),
    ).toHaveLength(1);
  });

  it("switches to the chosen language and shows it on the button", () => {
    mount();
    for (const [name, id] of [
      ["Français", "fr"],
      ["Español", "es"],
      ["Русский", "ru"],
      ["简体中文", "zh-Hans"],
      ["العربية", "ar"],
    ]) {
      button().click();
      options()
        .find((o) => o.textContent === name)!
        .click();
      expect(switched.at(-1)).toBe(id);
      expect(button().textContent).toBe(name);
      expect(options()).toHaveLength(0);
    }
  });

  it("shows English for a language the sites do not offer", () => {
    i18n.loadAndActivate({ locale: "ja", messages: {} });
    mount();
    expect(button().textContent).toBe("English");
  });
});
