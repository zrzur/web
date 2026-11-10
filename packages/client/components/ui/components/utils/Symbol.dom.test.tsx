import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@revolt/state", () => ({ useState: () => undefined }));

import { Symbol } from "./Symbol";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

function drawn(name: string) {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(() => <Symbol>{name}</Symbol>, host);
  return host.querySelector<HTMLElement>("[data-icon]")!;
}

it("maps a Material name to its icon", () => {
  expect(drawn("settings").dataset.icon).toBe("gear-six");
});

it("takes an icon name as it is", () => {
  expect(drawn("trash").dataset.icon).toBe("trash");
});

it.each(["toString", "constructor", "__proto__", "valueOf"])(
  "draws the neutral icon for the object key %s",
  (name) => {
    const icon = drawn(name);
    expect(icon.dataset.icon).toBe("circle");
    expect(icon.querySelector("svg")).not.toBeNull();
  },
);
