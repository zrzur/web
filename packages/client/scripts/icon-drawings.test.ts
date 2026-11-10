import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { drawings } from "../components/ui/icons/drawings";

import {
  buildDrawings,
  checkElement,
  innerMarkup,
  renderDrawings,
} from "./icon-drawings.mjs";

const client = join(__dirname, "..");
const root =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">';
const wrap = (inside: string, svg = root) => `${svg}${inside}</svg>`;

describe("icon drawings", () => {
  it("drawings.ts is what the SVG files make", async () => {
    const current = readFileSync(
      join(client, "components/ui/icons/drawings.ts"),
      "utf8",
    );
    expect(await renderDrawings(await buildDrawings(client), client)).toBe(
      current,
    );
    const files = readdirSync(join(client, "components/ui/icons/hugeicons"));
    expect(Object.keys(drawings)).toHaveLength(
      files.filter((f) => f.endsWith(".svg")).length,
    );
  }, 30_000);

  it("is a frozen table with no prototype", () => {
    expect(Object.getPrototypeOf(drawings)).toBeNull();
    expect(Object.isFrozen(drawings)).toBe(true);
    expect("toString" in drawings).toBe(false);
    expect(Object.hasOwn(drawings, "__proto__")).toBe(false);
  });

  it("keeps a plain drawing, with bare values where safe", () => {
    expect(
      innerMarkup(
        wrap('<path d="M1 2h3" stroke="currentColor" class="z-shape"/>'),
      ),
    ).toBe('<path d="M1 2h3" stroke=currentColor class=z-shape />');
    expect(
      innerMarkup(
        wrap(
          '<g transform="rotate(90 12 12)"><circle cx="12" cy="12" r="2" fill="currentColor"/></g>',
        ),
      ),
    ).toContain("<g ");
  });

  it.each([
    ['<path d="M0 0" onload="alert(1)"/>', "event handler"],
    ["<script>alert(1)</script>", "script element"],
    ['<a href="https://example.test"><path d="M0 0"/></a>', "link element"],
    ['<use href="#x"/>', "href on an allowed-looking element"],
    ['<path d="M0 0" style="fill:red"/>', "style attribute"],
    ['<image x="0" y="0" width="1" height="1"/>', "image element"],
    ['<foreignObject width="1" height="1"/>', "foreignObject"],
    ["<path d=M0/>", "unquoted value"],
    ['<path d="M0 0"/>text', "text content"],
    ['<!-- note --><path d="M0 0"/>', "comment"],
  ])("refuses %s (%s)", (inside) => {
    expect(() => innerMarkup(wrap(inside))).toThrow();
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" onload="x">',
    '<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 24 24">',
    '<svg viewBox="0 0 24 24" fill="none" class="x">',
  ])("refuses the root %s", (svg) => {
    expect(() => innerMarkup(wrap('<path d="M0 0"/>', svg))).toThrow();
  });

  it("checks the elements the Hugeicons generator writes", () => {
    expect(() =>
      checkElement("path", { d: "M0 0", "stroke-linecap": "round" }),
    ).not.toThrow();
    expect(() => checkElement("path", { onload: "x" })).toThrow();
    expect(() => checkElement("script", {})).toThrow();
    expect(() => checkElement("path", { href: "x" })).toThrow();
  });
});
