import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => ({
  ...(await import("@revolt/ui/components/design/Settings")),
  Toggle: (await import("@revolt/ui/components/design/Toggle")).Toggle,
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));

import { saveData, setSaveData } from "@revolt/common/lib/saveData";

import { SaveDataSettings } from "./SaveData";

let dispose: (() => void) | undefined;

function mount() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <SaveDataSettings />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const toggle = () =>
  document.querySelector<HTMLButtonElement>('[role="switch"]')!;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  localStorage.clear();
  setSaveData(false);
});
afterEach(() => {
  dispose?.();
  setSaveData(false);
});

describe("the Save data page", () => {
  it("is off until the person turns it on", () => {
    mount();
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(saveData()).toBe(false);
  });

  it("turns on with its switch and keeps the choice on this device", () => {
    mount();
    toggle().click();
    expect(saveData()).toBe(true);
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem("zrzur:save-data")).toBe("1");
    toggle().click();
    expect(saveData()).toBe(false);
    expect(localStorage.getItem("zrzur:save-data")).toBe("0");
  });

  it("names its switch for screen readers", () => {
    mount();
    const label = document.getElementById(
      toggle().getAttribute("aria-labelledby")!,
    );
    expect(label?.textContent).toBe("Save data");
  });

  it("lists what it changes, one line each", () => {
    mount();
    const lines = [
      ...document.querySelectorAll("[data-save-data-changes] li"),
    ].map((line) => line.textContent);
    expect(lines).toEqual([
      "Large pictures wait for a tap. Small ones load as usual.",
      "GIFs and videos do not load or play until you tap them.",
      "Link previews show their text. Their pictures wait for a tap.",
      "Avatars, server icons and banners load as previews, never as the animated original.",
      "Animated decorations, nameplates and profile effects stay still.",
      "Nothing is downloaded ahead for screens you have not opened.",
      "In calls your voice is sent at a lower bitrate, and other people's cameras and screens wait for a tap.",
    ]);
  });

  it("shows the list whether the switch is on or off", () => {
    mount();
    const count = () =>
      document.querySelectorAll("[data-save-data-changes] li").length;
    expect(count()).toBe(7);
    toggle().click();
    expect(count()).toBe(7);
  });
});
