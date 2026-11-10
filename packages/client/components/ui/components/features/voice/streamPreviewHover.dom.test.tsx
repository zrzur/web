import { i18n } from "@lingui/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchStreamPreview = vi.fn(async () => "data:image/jpeg;base64,AAAA");
vi.mock("@revolt/rtc/voiceExtrasStore", () => ({
  fetchStreamPreview: () => fetchStreamPreview(),
}));

import { clearPreviews } from "./streamPreviewCache";
import { streamPreviewHover } from "./streamPreviewHover";

function row(sharing = true) {
  const element = document.createElement("div");
  document.body.append(element);
  const hover = streamPreviewHover({
    sharing: () => sharing,
    client: () => ({}) as never,
    channel: () => ({ id: "vc" }) as never,
    userId: () => "sharer",
    name: () => "Sharer",
  });
  element.addEventListener("pointerenter", (event) => void hover.enter(event));
  element.addEventListener("pointerleave", () => hover.leave());
  return { element, hover };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren();
  clearPreviews();
  fetchStreamPreview.mockClear();
});

describe("stream preview on hover", () => {
  it("hovering someone who shares their screen shows the still", async () => {
    const { element } = row();
    element.dispatchEvent(new Event("pointerenter"));
    const card = await vi.waitFor(
      () => {
        const found = element.querySelector("[data-stream-preview] img");
        if (!found) throw new Error("no card yet");
        return found.closest("[data-stream-preview]");
      },
      { timeout: 5000 },
    );
    expect(card!.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/jpeg;base64,AAAA",
    );
    element.dispatchEvent(new Event("pointerleave"));
    expect(element.querySelector("[data-stream-preview]")).toBeNull();
  });

  it("shows nothing for someone who does not share, and fetches nothing", async () => {
    const { element } = row(false);
    element.dispatchEvent(new Event("pointerenter"));
    await flush();
    expect(element.querySelector("[data-stream-preview]")).toBeNull();
    expect(fetchStreamPreview).not.toHaveBeenCalled();
  });

  it("a pointer that left before the card loaded leaves no card behind", async () => {
    const { element } = row();
    element.dispatchEvent(new Event("pointerenter"));
    element.dispatchEvent(new Event("pointerleave"));
    // the card module loads (other tests may have loaded it already)
    await import("./StreamPreviewCard");
    await flush();
    expect(element.querySelector("[data-stream-preview]")).toBeNull();
  });

  it("the card goes with the row when the row is taken away", async () => {
    const { element, hover } = row();
    element.dispatchEvent(new Event("pointerenter"));
    await vi.waitFor(
      () => {
        if (!element.querySelector("[data-stream-preview]"))
          throw new Error("no card yet");
      },
      { timeout: 5000 },
    );
    hover.dispose();
    expect(element.querySelector("[data-stream-preview]")).toBeNull();
  });
});
