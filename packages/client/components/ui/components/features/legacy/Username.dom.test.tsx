import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { setNameView } from "../profiles/userStyle";

import { Username } from "./Username";

const view = { plain: false, light: false, still: false };
const ROLE = "linear-gradient(90deg, #9ca3af, #4b5563)";

let root: HTMLDivElement | undefined;
afterEach(() => {
  root?.remove();
  root = undefined;
  setNameView(view);
});

function draw(props: Parameters<typeof Username>[0]) {
  root = document.createElement("div");
  document.body.append(root);
  render(() => <Username {...props} />, root);
  return root;
}

/** the innermost element that holds the name's letters */
const letters = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>("span")].filter(
    (span) => span.childElementCount === 0 && span.textContent === "Maher",
  )[0];

/** every inline style on the way from the letters up to the component */
const styles = (el: HTMLElement, top: HTMLElement) => {
  const found: CSSStyleDeclaration[] = [];
  for (let n: HTMLElement | null = el; n && n !== top; n = n.parentElement)
    found.push(n.style);
  return found;
};

describe("a name with a role colour", () => {
  it("shows the highest role's colour over the person's own colour", () => {
    const el = draw({
      username: "Maher",
      colour: ROLE,
      userStyle: {
        name_font: "serif",
        name_colour: ["#3b82f6"],
        name_effect: "halo",
      },
    });
    const name = letters(el);
    const all = styles(name, el);
    // the role's gradient is drawn, and the chosen blue is not
    expect(all.some((s) => /gradient/.test(s.background))).toBe(true);
    expect(all.some((s) => s.color === "rgb(59, 130, 246)")).toBe(false);
    // the chosen font stays
    expect(all.some((s) => /Georgia/.test(s.fontFamily))).toBe(true);
    // marked, so a nameplate row keeps the role colour too
    expect(name.closest("[data-role-colour]")).not.toBeNull();
    expect(el.querySelector("[data-own-colour]")).toBeNull();
  });

  it("shows the person's own colour when no role of theirs has one", () => {
    const el = draw({
      username: "Maher",
      userStyle: { name_font: "serif", name_colour: ["#3b82f6"] },
    });
    const name = letters(el);
    expect(styles(name, el).some((s) => s.color === "rgb(59, 130, 246)")).toBe(
      true,
    );
    expect(name.closest("[data-own-colour]")).not.toBeNull();
    expect(el.querySelector("[data-role-colour]")).toBeNull();
  });

  it("takes the role colour when the person chose no colour", () => {
    const el = draw({
      username: "Maher",
      colour: ROLE,
      userStyle: { name_font: "serif", name_effect: "halo" },
    });
    const all = styles(letters(el), el);
    expect(all.some((s) => /gradient/.test(s.background))).toBe(true);
    // the chosen font still applies
    expect(all.some((s) => /Georgia/.test(s.fontFamily))).toBe(true);
    expect(el.querySelector("[data-own-colour]")).toBeNull();
    // marked, so a nameplate row keeps the role colour too
    expect(letters(el).closest("[data-role-colour]")).not.toBeNull();
  });

  it("marks a plain role colour, with no style at all", () => {
    const el = draw({ username: "Maher", colour: "#f59e0b" });
    const name = letters(el);
    expect(styles(name, el).some((s) => s.color === "rgb(245, 158, 11)")).toBe(
      true,
    );
    expect(name.closest("[data-role-colour]")).not.toBeNull();
  });

  it("marks neither colour when there is none", () => {
    const el = draw({ username: "Maher", userStyle: { name_font: "serif" } });
    expect(el.querySelector("[data-role-colour]")).toBeNull();
    expect(el.querySelector("[data-own-colour]")).toBeNull();
  });

  it("with name styles turned off shows the role colour and nothing chosen", () => {
    setNameView({ ...view, plain: true });
    const el = draw({
      username: "Maher",
      colour: ROLE,
      userStyle: { name_font: "serif", name_colour: ["#3b82f6"] },
    });
    const all = styles(letters(el), el);
    expect(all.some((s) => /gradient/.test(s.background))).toBe(true);
    expect(all.some((s) => s.color === "rgb(59, 130, 246)")).toBe(false);
    expect(all.some((s) => /Georgia/.test(s.fontFamily))).toBe(false);
    expect(el.querySelector("[data-own-colour]")).toBeNull();
    expect(letters(el).closest("[data-role-colour]")).not.toBeNull();
  });

  it("leaves room around the letters for a glow and slanted fonts", () => {
    const el = draw({
      username: "Maher",
      userStyle: { name_font: "script", name_effect: "halo" },
    });
    // the box that clips the name is wider and taller than its line, by
    // as much as it is pulled back, so nothing moves
    const box = el.querySelector<HTMLElement>("[data-name-room]");
    expect(box).not.toBeNull();
    expect(box!.contains(letters(el))).toBe(true);
  });
});
