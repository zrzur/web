import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PLATE_INK, PLATE_OWN_COLOUR } from "./plateInk";

/** A member row on a nameplate, as MemberSidebar draws it */
function row(name: string) {
  const el = document.createElement("div");
  el.setAttribute("data-plated", "");
  el.innerHTML = `<div data-nameplate></div><div><span class="line">${name}<span class="status">zrzur.com</span></span></div>`;
  return el;
}

const inked = (row: HTMLElement, el: Element) =>
  [...row.querySelectorAll(PLATE_INK.replace(/&/g, ":scope"))].includes(el);

describe("words on a nameplate", () => {
  it("take the plate's ink: status and a name without a chosen colour", () => {
    const el = row(`<span class="name">Maher</span>`);
    expect(inked(el, el.querySelector(".name")!)).toBe(true);
    expect(inked(el, el.querySelector(".status")!)).toBe(true);
  });

  it("leave a name in its own chosen colour, and everything inside it", () => {
    const el = row(
      `<span class="name" data-own-colour><span class="inner">Maher</span></span>`,
    );
    expect(inked(el, el.querySelector(".name")!)).toBe(false);
    expect(inked(el, el.querySelector(".inner")!)).toBe(false);
    // the status beside it still takes the ink
    expect(inked(el, el.querySelector(".status")!)).toBe(true);
  });

  it("gives an own-coloured name its fill back from the boxes around it", () => {
    const el = row(`<span class="name" data-own-colour>Maher</span>`);
    const own = [
      ...el.querySelectorAll(PLATE_OWN_COLOUR.replace(/&/g, ":scope")),
    ];
    expect(own).toEqual([el.querySelector(".name")]);
  });

  it("is the rule the member list draws with", () => {
    // Panda reads only a written-out key: MemberSidebar spells it out
    const source = readFileSync(
      resolve(__dirname, "MemberSidebar.tsx"),
      "utf8",
    );
    expect(source).toContain(JSON.stringify(PLATE_INK));
    expect(source).toContain(JSON.stringify(PLATE_OWN_COLOUR));
  });
});
