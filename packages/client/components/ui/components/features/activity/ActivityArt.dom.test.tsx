import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { ActivityArt } from "./ActivityArt";

let dispose: (() => void) | undefined;
afterEach(() => dispose?.());

function mount(view: () => ReturnType<typeof ActivityArt>) {
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(view, document.getElementById("root")!);
  return document.querySelector<HTMLElement>("[data-testid=activity-art]")!;
}

describe("ActivityArt", () => {
  it("shows a letter tile, never a generic icon, when there is no picture", () => {
    const art = mount(() => <ActivityArt size="card" name="quill notes" />);
    expect(art.dataset.kind).toBe("letter");
    expect(art.textContent).toBe("Q");
    expect(art.querySelector("svg")).toBeNull();
    expect(art.querySelector("img")).toBeNull();
  });

  it("shows the picture, and the letter tile when the picture fails", () => {
    const art = mount(() => (
      <ActivityArt
        size="card"
        name="Counter-Strike 2"
        src="https://proxy.zrzur.com/proxy?url=x"
      />
    ));
    const img = art.querySelector("img")!;
    expect(art.dataset.kind).toBe("picture");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(img.alt).toBe("");
    img.dispatchEvent(new Event("error"));
    expect(art.dataset.kind).toBe("letter");
    expect(art.textContent).toBe("C");
  });

  it("keeps a tall cover's shape on the card only", () => {
    const art = mount(() => (
      <ActivityArt size="card" name="Stardew Valley" src="https://p/x" />
    ));
    const img = art.querySelector("img")!;
    Object.defineProperty(img, "naturalWidth", { value: 600 });
    Object.defineProperty(img, "naturalHeight", { value: 900 });
    img.dispatchEvent(new Event("load"));
    expect(art.hasAttribute("data-tall")).toBe(true);
  });

  it("gives a new picture a new chance after a failed one", () => {
    const [src, setSrc] = createSignal("https://p/broken");
    const art = mount(() => (
      <ActivityArt size="row" name="Figma" src={src()} />
    ));
    art.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(art.dataset.kind).toBe("letter");
    setSrc("https://p/working");
    expect(art.dataset.kind).toBe("picture");
    expect(art.querySelector("img")!.getAttribute("src")).toBe(
      "https://p/working",
    );
  });

  it("shows the corner picture on the card only", () => {
    const card = mount(() => (
      <ActivityArt size="card" name="A" src="https://p/a" badge="https://p/b" />
    ));
    expect(card.querySelectorAll("img")).toHaveLength(2);
    dispose?.();
    const line = mount(() => (
      <ActivityArt size="line" name="A" src="https://p/a" badge="https://p/b" />
    ));
    expect(line.querySelectorAll("img")).toHaveLength(1);
  });
});
