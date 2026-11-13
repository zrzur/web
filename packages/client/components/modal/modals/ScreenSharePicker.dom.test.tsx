import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", () => ({
  Column: (props: { children?: unknown }) => (
    <div>{props.children as never}</div>
  ),
  Dialog: (props: {
    children?: unknown;
    title?: string;
    actions?: {
      text: unknown;
      onClick?: () => unknown;
      isDisabled?: boolean;
    }[];
  }) => (
    <div role="dialog">
      <h2>{props.title}</h2>
      {props.children as never}
      <button
        data-testid="start"
        ref={(button) => {
          // read while rendering (the action texts are translated elements)
          const action = props.actions?.[1];
          button.disabled = !!action?.isDisabled;
          button.onclick = () => action?.onClick?.();
        }}
      >
        start
      </button>
    </div>
  ),
  FloatingSelect: (props: { children?: unknown }) => (
    <div data-testid="quality-select">{props.children as never}</div>
  ),
  MenuItem: (props: { children?: unknown }) => (
    <span>{props.children as never}</span>
  ),
  Form2: {
    Checkbox: (props: { children?: unknown }) => (
      <label>{props.children as never}</label>
    ),
    ButtonGroup: () => <div />,
  },
}));
// solid-forms does not load under the test runner; the picker only reads .value
vi.mock("solid-forms", () => ({
  createFormControl: (value: unknown) => ({ value }),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({
  Icon: (props: { name: string }) => <i data-icon={props.name} />,
}));
vi.mock("@revolt/state", () => ({
  useState: () => ({
    voice: {
      screenShareQuality: "720p30",
      screenShareContent: "motion",
      screenShareAudio: true,
    },
  }),
}));
vi.mock("./ScreenShareSettings", () => ({
  ContentChoice: () => <div />,
  offeredQuality: (qualities: { name: string }[], wanted: string) =>
    qualities.some((q) => q.name === wanted) ? wanted : qualities[0].name,
}));

import { ScreenSharePickerModal } from "./ScreenSharePicker";

const SHOT = "data:image/jpeg;base64,QUJD";
const ICON = "data:image/png;base64,QUJDREVGR0hJSktMTU5P";
const sources: Record<string, unknown>[] = [
  {
    idx: 0,
    kind: "screen",
    name: "Gesamter Bildschirm",
    isFullScreen: true,
    screenNumber: 1,
    screenCount: 1,
    thumbnail: SHOT,
  },
  {
    idx: 1,
    kind: "window",
    name: "Notes",
    isFullScreen: false,
    thumbnail: SHOT,
    image: ICON,
  },
  { idx: 2, kind: "window", name: "Einstellungen", isFullScreen: false },
];

let dispose: (() => void) | undefined;
const callback = vi.fn();
const onCancel = vi.fn();
const onClose = vi.fn();

function mount(
  list: Record<string, unknown>[] = sources,
  qualities = [{ name: "720p30", fullName: "720p · 30 FPS" }],
) {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ScreenSharePickerModal
          {...({
            type: "screen_share_picker",
            show: true,
            onClose,
            onCancel,
            callback,
            qualities,
            sources: list,
          } as unknown as Parameters<typeof ScreenSharePickerModal>[0])}
        />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}
const cards = () =>
  [
    ...document.querySelectorAll('[data-testid="share-source"]'),
  ] as HTMLElement[];
const tab = (kind: string) =>
  document.querySelector(`[data-testid="share-tab-${kind}"]`) as HTMLElement;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  callback.mockClear();
  onCancel.mockClear();
  onClose.mockClear();
});
afterEach(() => dispose?.());

describe("screen share picker", () => {
  it("opens on Screens with the screen chosen and named by Zrzur, not by the system", () => {
    mount();
    expect(tab("screen").getAttribute("aria-selected")).toBe("true");
    expect(cards()).toHaveLength(1);
    expect(cards()[0].textContent).toBe("Entire screen");
    expect(cards()[0].getAttribute("aria-checked")).toBe("true");
    expect(cards()[0].querySelector("img")?.getAttribute("src")).toBe(SHOT);
    expect(document.body.textContent).not.toContain("Gesamter Bildschirm");
    // one quality: said as text, no menu with a single entry
    expect(document.querySelector('[data-testid="quality-select"]')).toBeNull();
    expect(document.body.textContent).toContain("720p · 30 FPS");
  });

  it("numbers the screens when there are several", () => {
    mount([
      { ...sources[0], screenCount: 2 },
      { ...sources[0], idx: 3, screenNumber: 2, screenCount: 2 },
    ]);
    expect(cards().map((card) => card.textContent)).toEqual([
      "Screen 1",
      "Screen 2",
    ]);
  });

  it("Windows tab: previews and icons, and a plain symbol where the system gave none", () => {
    mount();
    tab("window").click();
    expect(cards().map((card) => card.textContent)).toEqual([
      "Notes",
      "Einstellungen",
    ]);
    // switching tabs keeps something chosen
    expect(cards()[0].getAttribute("aria-checked")).toBe("true");
    expect(cards()[0].querySelectorAll("img")).toHaveLength(2);
    // no picture and no icon: symbols, never a broken image
    expect(cards()[1].querySelectorAll("img")).toHaveLength(0);
    expect(cards()[1].querySelectorAll("[data-icon]").length).toBeGreaterThan(
      0,
    );
  });

  it("a picture that fails to load is replaced by the symbol", () => {
    mount();
    tab("window").click();
    for (const img of cards()[0].querySelectorAll("img"))
      img.dispatchEvent(new Event("error"));
    expect(cards()[0].querySelectorAll("img")).toHaveLength(0);
    expect(cards()[0].querySelectorAll("[data-icon]").length).toBeGreaterThan(
      0,
    );
  });

  it("starts with the chosen source; a double click starts at once; only once", () => {
    mount();
    tab("window").click();
    cards()[1].click();
    (document.querySelector('[data-testid="start"]') as HTMLElement).click();
    expect(callback).toHaveBeenCalledWith(2, "720p30", true, "motion");
    (document.querySelector('[data-testid="start"]') as HTMLElement).click();
    expect(callback).toHaveBeenCalledTimes(1);
    dispose?.();

    document.body.replaceChildren(document.createElement("div"));
    callback.mockClear();
    mount();
    tab("window").click();
    cards()[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(callback).toHaveBeenCalledWith(1, "720p30", true, "motion");
  });

  it("the arrow keys move the choice and Enter starts", () => {
    mount();
    tab("window").click();
    const grid = cards()[0].parentElement as HTMLElement;
    grid.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(cards()[1].getAttribute("aria-checked")).toBe("true");
    grid.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(callback).toHaveBeenCalledWith(2, "720p30", true, "motion");
  });

  it("says so when nothing can be shared, and cannot start", () => {
    mount([]);
    expect(document.body.textContent).toContain(
      "No screen can be shared right now.",
    );
    expect(
      (document.querySelector('[data-testid="start"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("several qualities are a menu", () => {
    mount(sources, [
      { name: "720p30", fullName: "720p · 30 FPS" },
      { name: "1080p60", fullName: "1080p · 60 FPS" },
    ]);
    expect(
      document.querySelector('[data-testid="quality-select"]')?.textContent,
    ).toContain("1080p · 60 FPS");
  });
});
