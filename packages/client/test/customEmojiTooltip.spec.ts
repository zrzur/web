import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { expect, it, vi } from "vitest";
import { RenderCustomEmoji } from "../components/markdown/plugins/customEmoji";
const fixture = vi.hoisted(() => ({ floating: vi.fn(), serverReads: vi.fn() }));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({
    emojis: { get: () => ({ name: "ss" }) },
    servers: { get: fixture.serverReads },
  }),
}));
vi.mock("../components/markdown/emoji", () => ({
  CustomEmoji: () => {
    const image = document.createElement("img");
    image.alt = ":ss:";
    return image;
  },
}));
it("renders custom emoji without hover tooltip or server lookup", () => {
  (globalThis as { floating?: unknown }).floating = fixture.floating;
  const host = document.createElement("div");
  const dispose = render(
    () => createComponent(RenderCustomEmoji, { id: "emoji-id" }),
    host,
  );
  expect(host.querySelectorAll("img")).toHaveLength(1);
  host
    .querySelector("img")!
    .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(host.textContent).toBe("");
  expect(host.querySelector("[title], [role=tooltip]")).toBeNull();
  expect(fixture.floating).not.toHaveBeenCalled();
  expect(fixture.serverReads).not.toHaveBeenCalled();
  dispose();
  delete (globalThis as { floating?: unknown }).floating;
});
