import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Icon } from "./Icon";
import { type IconName, iconRegistry } from "./registry";

vi.mock("@revolt/state", () => ({ useState: () => undefined }));

const SVG_NS = "http://www.w3.org/2000/svg";
const svgDir = resolve(__dirname, "hugeicons");

/**
 * Each icon file through svgo's default preset. That is what
 * vite-plugin-solid-svg ran before (it found no svgo.config), and the
 * component it built drew those elements; drawings.ts must draw the same.
 */
async function optimisedFiles() {
  const { createRequire } = await import("node:module");
  const require = createRequire(join(__dirname, "../../../package.json"));
  const plugin = require.resolve("vite-plugin-solid-svg");
  const { optimize } = await import(
    /* @vite-ignore */ createRequire(plugin).resolve("svgo")
  );
  return Object.fromEntries(
    readdirSync(svgDir)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => [
        f.slice(0, -4),
        optimize(readFileSync(join(svgDir, f), "utf8"), {
          path: join(svgDir, f),
        }).data as string,
      ]),
  );
}

/** Tag, namespace and attributes of an element and everything inside it */
function shape(el: Element): unknown {
  return {
    tag: el.localName,
    ns: el.namespaceURI,
    attrs: Object.fromEntries(
      [...el.attributes].map((a) => [a.name, a.value]).sort(),
    ),
    children: [...el.children].map(shape),
  };
}

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
});

function draw(name: IconName, size?: number) {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(() => <Icon name={name} size={size} />, host);
  return host;
}

describe("Icon", () => {
  it("draws every icon exactly as its optimised SVG file", async () => {
    const files = await optimisedFiles();
    const names = Object.keys(iconRegistry) as IconName[];
    expect(names.length).toBeGreaterThan(150);
    for (const name of names) {
      if (name === "robot") continue; // drawn as the Zrzur mark
      const host = draw(name, 20);
      const svg = host.querySelector("svg")!;
      expect(svg, name).not.toBeNull();
      expect(svg.namespaceURI).toBe(SVG_NS);

      const file = new DOMParser().parseFromString(
        files[name],
        "image/svg+xml",
      ).documentElement;
      // the file's own <svg> attributes are all on the drawn one
      for (const attr of [...file.attributes])
        expect(svg.getAttribute(attr.name), `${name} ${attr.name}`).toBe(
          attr.value,
        );
      expect(svg.getAttribute("width")).toBe("20");
      expect(svg.getAttribute("height")).toBe("20");
      // and the same elements inside, in the SVG namespace
      expect([...svg.children].map(shape), name).toEqual(
        [...file.children].map(shape),
      );
      dispose?.();
      host.remove();
    }
    // 203 icons through svgo and jsdom: 7.4 s once in a full parallel run
  }, 30_000);

  it("follows a name change and draws nothing for an unknown name", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const [name, setName] = createSignal<IconName>("bell");
    dispose = render(() => <Icon name={name()} />, host);
    const first = host.querySelector("svg")!.innerHTML;
    setName("trash");
    expect(host.querySelector("svg")!.innerHTML).not.toBe(first);
    expect(host.querySelector("svg")!.innerHTML).toBe(
      document
        .createRange()
        .createContextualFragment(
          `<svg xmlns="${SVG_NS}">${iconRegistry.trash}</svg>`,
        ).firstElementChild!.innerHTML,
    );
    setName("no-such-icon" as IconName);
    expect(host.querySelector("svg")).toBeNull();
    expect(host.querySelector("[data-icon]")).not.toBeNull();
  });

  it.each(["toString", "__proto__", "constructor", "hasOwnProperty"])(
    "draws nothing for the object key %s",
    (name) => {
      const host = draw(name as IconName);
      expect(host.querySelector("svg")).toBeNull();
      expect(host.querySelector("[data-icon]")).not.toBeNull();
    },
  );

  it("draws the bot icon as the Zrzur mark", () => {
    const host = draw("robot");
    expect(host.querySelector("svg")).toBeNull();
    expect(host.querySelector("[data-icon-mark]")).not.toBeNull();
  });
});
