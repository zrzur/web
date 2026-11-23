import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lazy } from "../../../common/lib/lazyPart";
import { PageBoundary } from "../utils/PageBoundary";

import { Dialog } from "./Dialog";

// @solid-aria ships extensionless ESM imports that Node cannot load here
vi.mock("./Button", () => ({
  Button: (props: { children?: unknown; onPress?: () => void }) => (
    <button type="button" onClick={() => props.onPress?.()}>
      {props.children as string}
    </button>
  ),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/state", () => ({
  useState: () => ({ motion: { resolve: () => undefined } }),
}));

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

let dispose: (() => void) | undefined;
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
  document.body.innerHTML = '<div id="floating"></div><div id="root"></div>';
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

describe("a part inside an open window that could not be downloaded", () => {
  it("shows the note inside the window; the window and what was typed stay", async () => {
    let calls = 0;
    // e.g. the sound library inside the soundboard settings
    const Library = lazy(() =>
      ++calls === 1
        ? Promise.reject(
            new TypeError("Failed to fetch dynamically imported module"),
          )
        : Promise.resolve({
            default: () => <ul data-testid="library">sounds</ul>,
          }),
    );
    const onClose = vi.fn();
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <Dialog show title="Soundboard" onClose={onClose}>
            <input data-testid="name" />
            {/* as SoundboardList holds the sound library */}
            <PageBoundary>
              <Library />
            </PageBoundary>
          </Dialog>
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    const name = document.querySelector<HTMLInputElement>(
      '[data-testid="name"]',
    )!;
    name.value = "airhorn";
    await tick();

    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    const note = dialog.querySelector("[data-part-not-loaded]");
    expect(note?.textContent).toContain("Could not open.");
    expect(onClose).not.toHaveBeenCalled();

    // Try again, with the connection back: the part comes; the window and
    // the name typed into it are still there
    [...note!.querySelectorAll("button")]
      .find((b) => b.textContent === "Try again")!
      .click();
    await tick();
    expect(dialog.querySelector('[data-testid="library"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);
    expect(
      document.querySelector<HTMLInputElement>('[data-testid="name"]')?.value,
    ).toBe("airhorn");
  });

  it("a part without a boundary of its own: the note fills the window's body, the window stays", async () => {
    const Part = lazy(() =>
      Promise.reject(
        new TypeError("Failed to fetch dynamically imported module"),
      ),
    );
    const onClose = vi.fn();
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <Dialog show title="Insights" onClose={onClose}>
            <Part />
          </Dialog>
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    await tick();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector("[data-part-not-loaded]")).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
