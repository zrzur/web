import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", () => ({
  Button: (props: {
    children?: unknown;
    onPress?: () => void;
    "data-testid"?: string;
  }) => (
    <button
      data-testid={props["data-testid"]}
      onClick={() => props.onPress?.()}
    >
      {props.children as never}
    </button>
  ),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <i /> }));

import { FrameGuides } from "@revolt/ui/components/features/profiles/frames/FrameGuides";

import { FrameGuide } from "./FrameGuide";

let dispose: (() => void) | undefined;
const calls = { back: 0, upload: 0 };
const clicked: string[] = [];

function mount(upload: boolean) {
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <FrameGuide
          onBack={() => calls.back++}
          onUpload={upload ? () => calls.upload++ : undefined}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
}

beforeEach(() => {
  calls.back = 0;
  calls.upload = 0;
  clicked.length = 0;
  i18n.loadAndActivate({ locale: "en", messages: {} });
  // what the downloads open, without leaving the page
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(`${this.getAttribute("href")} ${this.download}`);
  });
});
afterEach(() => {
  dispose?.();
  vi.restoreAllMocks();
});

const testid = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("the frame guide", () => {
  it("states the numbers the upload checks", () => {
    mount(true);
    const text = testid("frame-guide")!.textContent!;
    for (const value of [
      "800 × 1020 px",
      "680 × 800 px",
      "60, 140 – 740, 940",
      "80, 160 – 720, 920",
      "240, 160 – 560, 220",
      "140 px",
      "60 px",
      "80 px",
      "20 px",
      "Up to 2.5 MB",
      "PNG, WebP or GIF",
    ])
      expect(text).toContain(value);
  });

  it("downloads the kit and each of its files", () => {
    mount(true);
    for (const id of [
      "frame-guide-kit",
      "frame-guide-file-svg",
      "frame-guide-file-png",
      "frame-guide-file-example",
    ])
      testid(id)!.click();
    expect(clicked).toEqual([
      "/frame-kit/zrzur-frame-kit.zip zrzur-frame-kit.zip",
      "/frame-kit/template.svg template.svg",
      "/frame-kit/template.png template.png",
      "/frame-kit/example-frame.png example-frame.png",
    ]);
  });

  it("offers the upload only to those who can upload", () => {
    mount(false);
    expect(testid("frame-guide-upload")).toBeNull();
    dispose?.();
    mount(true);
    testid("frame-guide-upload")!.click();
    expect(calls.upload).toBe(1);
  });
});

describe("the guides over a framed card", () => {
  it("scales the reach, the safe zone and the crest window with the card", () => {
    document.body.innerHTML = '<div id="root"></div>';
    dispose = render(
      () => <FrameGuides width={360} />,
      document.getElementById("root")!,
    );
    const part = (name: string) =>
      document.querySelector<HTMLElement>(`[data-guide="${name}"]`)!.style;
    const s = 360 / 340;
    const px = (n: number) => `${+(n * s).toFixed(2)}px`;
    expect(part("reach").top).toBe(`-${px(70)}`);
    expect(part("reach").bottom).toBe(`-${px(40)}`);
    expect(part("reach").left).toBe(`-${px(30)}`);
    expect(part("safe").inset).toBe(px(10));
    expect(part("crest").left).toBe(px(90));
    expect(part("crest").width).toBe(px(160));
    expect(part("crest").height).toBe(px(30));
  });
});
