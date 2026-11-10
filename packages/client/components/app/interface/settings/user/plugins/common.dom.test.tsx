import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@revolt/state", () => ({ useState: () => undefined }));
vi.mock("@revolt/ui", () => ({ SettingsStatus: () => null }));

import { PluginIcon } from "./common";
import { categoryIcon } from "./text";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

function drawn(icon: string) {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(() => <PluginIcon icon={icon} category="developer" />, host);
  return host.querySelector<HTMLElement>("[data-icon]")!;
}

it("draws a plugin's own icon when Zrzur has it", () => {
  const icon = drawn("bell");
  expect(icon.dataset.icon).toBe("bell");
  expect(icon.querySelector("svg")).not.toBeNull();
});

it.each(["constructor", "toString", "__proto__", "no-such-icon"])(
  "falls back to the category icon for %s",
  (name) => {
    const icon = drawn(name);
    expect(icon.dataset.icon).toBe(categoryIcon("developer"));
    expect(icon.querySelector("svg")).not.toBeNull();
  },
);
