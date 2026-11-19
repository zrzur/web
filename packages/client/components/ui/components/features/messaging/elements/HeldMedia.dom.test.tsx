import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui/icons/Icon", () => ({
  Icon: (props: { name: string }) => <span data-icon={props.name} />,
}));

import {
  holdsPicture,
  saveData,
  setSaveData,
} from "@revolt/common/lib/saveData";

import { HeldMedia } from "./HeldMedia";

let dispose: (() => void) | undefined;

function mount(view: () => unknown) {
  dispose = render(
    () => <I18nProvider i18n={i18n}>{view() as never}</I18nProvider>,
    document.body.firstElementChild as HTMLElement,
  );
}

const picture = () => document.querySelector<HTMLImageElement>("img");
const tile = () =>
  document.querySelector<HTMLButtonElement>("[data-tap-to-load]");

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  setSaveData(false);
});
afterEach(() => {
  dispose?.();
  setSaveData(false);
});

describe("a picture that waits for a tap", () => {
  it("is not in the page at all until tapped: nothing can be downloaded", () => {
    mount(() => (
      <HeldMedia held kind="picture" id="held-1" size={8_589_528}>
        <img src="https://files.test/attachments/held-1" alt="" />
      </HeldMedia>
    ));
    expect(picture()).toBeNull();
    expect(tile()).not.toBeNull();
  });

  it("says what waits and how big it is", () => {
    mount(() => (
      <HeldMedia held kind="picture" id="held-2" size={8_589_528}>
        <img src="https://files.test/attachments/held-2" alt="" />
      </HeldMedia>
    ));
    expect(tile()!.getAttribute("aria-label")).toBe("Load picture (8.6 MB)");
    expect(tile()!.textContent).toContain("Load picture");
    expect(tile()!.textContent).toContain("8.6 MB");
    expect(tile()!.type).toBe("button");
  });

  it("loads on one tap and the placeholder goes", () => {
    mount(() => (
      <HeldMedia held kind="picture" id="held-3" size={900_000}>
        <img src="https://files.test/attachments/held-3" alt="" />
      </HeldMedia>
    ));
    tile()!.click();
    expect(tile()).toBeNull();
    expect(picture()!.getAttribute("src")).toBe(
      "https://files.test/attachments/held-3",
    );
  });

  it("does not open the picture viewer behind it with the same tap", () => {
    const outer = vi.fn();
    mount(() => (
      <div onClick={outer}>
        <HeldMedia held kind="picture" id="held-4">
          <img src="https://files.test/attachments/held-4" alt="" />
        </HeldMedia>
      </div>
    ));
    tile()!.click();
    expect(outer).not.toHaveBeenCalled();
  });

  it("stays loaded when the message is drawn again", () => {
    mount(() => (
      <HeldMedia held kind="picture" id="held-5">
        <img src="https://files.test/attachments/held-5" alt="" />
      </HeldMedia>
    ));
    tile()!.click();
    dispose?.();
    document.body.replaceChildren(document.createElement("div"));
    mount(() => (
      <HeldMedia held kind="picture" id="held-5">
        <img src="https://files.test/attachments/held-5" alt="" />
      </HeldMedia>
    ));
    expect(tile()).toBeNull();
    expect(picture()).not.toBeNull();
  });
});

describe("a GIF", () => {
  it("is named as one, and plays only after the tap", () => {
    mount(() => (
      <HeldMedia held kind="gif" id="gif-1" size={445_604}>
        <video autoplay src="https://proxy.test/clip.mp4" />
      </HeldMedia>
    ));
    expect(document.querySelector("video")).toBeNull();
    expect(tile()!.getAttribute("data-tap-to-load")).toBe("gif");
    expect(tile()!.getAttribute("aria-label")).toBe("Play GIF (446 KB)");
    tile()!.click();
    expect(document.querySelector("video")).not.toBeNull();
  });
});

describe("with a small preview from the media server", () => {
  const still = () =>
    document.querySelector<HTMLImageElement>("[data-tap-to-load] img");

  it("shows the small still picture, not the full one, with the size on a chip", () => {
    mount(() => (
      <HeldMedia
        held
        kind="picture"
        id="small-1"
        size={8_589_528}
        preview="https://files.test/attachments/small-1?size=small"
      >
        <img src="https://files.test/attachments/small-1" alt="" />
      </HeldMedia>
    ));
    expect(still()!.getAttribute("src")).toBe(
      "https://files.test/attachments/small-1?size=small",
    );
    expect(document.querySelectorAll("img").length).toBe(1);
    expect(tile()!.textContent).toBe("8.6 MB");
    expect(tile()!.getAttribute("aria-label")).toBe("Load picture (8.6 MB)");
    expect(tile()!.hasAttribute("data-preview")).toBe(true);
  });

  it("loads the full picture on one tap", () => {
    mount(() => (
      <HeldMedia
        held
        kind="picture"
        id="small-2"
        size={900_000}
        preview="https://files.test/attachments/small-2?size=small"
      >
        <img src="https://files.test/attachments/small-2" alt="" />
      </HeldMedia>
    ));
    tile()!.click();
    expect(tile()).toBeNull();
    expect(picture()!.getAttribute("src")).toBe(
      "https://files.test/attachments/small-2",
    );
  });

  it("marks a GIF with a play sign over its first frame", () => {
    mount(() => (
      <HeldMedia
        held
        kind="gif"
        id="small-3"
        size={445_604}
        preview="https://files.test/attachments/small-3?size=small"
      >
        <img src="https://files.test/attachments/small-3/original" alt="" />
      </HeldMedia>
    ));
    expect(still()!.getAttribute("src")).toContain("?size=small");
    expect(tile()!.querySelector('[data-icon="play"]')).not.toBeNull();
    expect(tile()!.getAttribute("aria-label")).toBe("Play GIF (446 KB)");
    expect(document.querySelector('img[src$="/original"]')).toBeNull();
  });

  it("is the picture alone in the small square of a link card", () => {
    mount(() => (
      <HeldMedia
        held
        kind="picture"
        id="small-4"
        compact
        frame={{ width: 48, height: 48 }}
        preview="https://files.test/attachments/small-4?size=small"
      >
        <img src="https://files.test/attachments/small-4" alt="" />
      </HeldMedia>
    ));
    expect(still()).not.toBeNull();
    expect(tile()!.textContent).toBe("");
  });
});

describe("the small square of a link preview", () => {
  it("shows the icon alone but keeps its name for screen readers", () => {
    mount(() => (
      <HeldMedia
        held
        kind="picture"
        id="thumb-1"
        compact
        frame={{ width: 48, height: 48 }}
      >
        <img src="https://proxy.test/thumb.png" alt="" />
      </HeldMedia>
    ));
    expect(tile()!.textContent).toBe("");
    expect(tile()!.getAttribute("aria-label")).toBe("Load picture");
    expect(tile()!.style.width).toBe("48px");
    expect(tile()!.style.height).toBe("48px");
  });
});

describe("with Save data off", () => {
  it("everything loads as before", () => {
    mount(() => (
      <HeldMedia held={false} kind="picture" id="free-1" size={8_589_528}>
        <img src="https://files.test/attachments/free-1" alt="" />
      </HeldMedia>
    ));
    expect(tile()).toBeNull();
    expect(picture()).not.toBeNull();
  });
});

describe("flipping the switch while a channel is open", () => {
  const file = { size: 8_589_528, contentType: "image/jpeg" };
  const view = () => (
    <HeldMedia held={holdsPicture(saveData(), file)} kind="picture" id="live-1">
      <img src="https://files.test/attachments/live-1" alt="" />
    </HeldMedia>
  );

  it("holds pictures back at once when turned on", () => {
    mount(view);
    expect(picture()).not.toBeNull();
    setSaveData(true);
    expect(picture()).toBeNull();
    expect(tile()).not.toBeNull();
  });

  it("loads them at once when turned off", () => {
    setSaveData(true);
    mount(view);
    expect(picture()).toBeNull();
    setSaveData(false);
    expect(picture()).not.toBeNull();
    expect(tile()).toBeNull();
  });
});
