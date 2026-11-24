import { render } from "solid-js/web";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { BadgeGlyph, loadBadgeArt } from "./BadgeGlyph";
import { BADGES, CONTEXT_BADGES, badgeMeta } from "./catalog";

let dispose: (() => void) | undefined;
beforeAll(() => loadBadgeArt());
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

function draw(id: string) {
  dispose?.();
  dispose = render(
    () => <BadgeGlyph badge={badgeMeta(id)!} size={20} />,
    document.body,
  );
  return document.body.querySelector("svg")!;
}

/** Inside `defs` nothing is painted; a clip shape needs no colour */
const painted = (svg: SVGElement) =>
  [...svg.querySelectorAll("path, circle, ellipse, rect")].filter(
    (shape) => !shape.closest("defs"),
  );

describe("badge art", () => {
  it("never falls back to the browser's black fill", () => {
    for (const badge of [...BADGES, ...CONTEXT_BADGES]) {
      for (const shape of painted(draw(badge.id))) {
        const coloured =
          shape.closest("[fill]") ||
          (shape.getAttribute("fill") ?? shape.getAttribute("stroke"));
        expect(coloured, `${badge.id}: ${shape.outerHTML}`).toBeTruthy();
      }
    }
  });

  it("draws the approved art for every badge, with ids of its own", () => {
    for (const badge of [...BADGES, ...CONTEXT_BADGES]) {
      const svg = draw(badge.id);
      expect(svg.getAttribute("data-art"), badge.id).toBe("v2");
      expect(svg.innerHTML, badge.id).not.toContain("{{ID}}");
    }
    // two badges on one page never share a gradient or clip id
    dispose?.();
    dispose = render(
      () => (
        <>
          <BadgeGlyph badge={badgeMeta("plus")!} size={20} />
          <BadgeGlyph badge={badgeMeta("plus")!} size={20} />
        </>
      ),
      document.body,
    );
    const ids = [...document.body.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses no stars or sparkles and no colours from other apps", () => {
    for (const badge of [...BADGES, ...CONTEXT_BADGES]) {
      const html = draw(badge.id).innerHTML.toUpperCase();
      for (const colour of ["#00D8FF", "#5865F2", "#FF005C"])
        expect(html, badge.id).not.toContain(colour);
    }
  });

  it("gives every badge still given out a silhouette of its own", () => {
    const seen = new Map<string, string>();
    // Founder, Staff and Early Adopter are all the Zrzur mark on its own,
    // told apart by colour only (owner, 2026-11-12)
    // and Verified Server Owner is the one verified seal, shared with Verified
    // Bot Developer (owner, 2026-11-12)
    const sameMark = new Set([
      "founder",
      "staff",
      "early_adopter",
      "verified_server_owner",
    ]);
    for (const badge of BADGES.filter(
      (b) => !b.retired && !sameMark.has(b.id),
    )) {
      // badges drawn as lines (the year numbers, the partner's loop) have no clip path
      const body =
        draw(badge.id).querySelector("clipPath path")?.getAttribute("d") ?? "";
      if (body === "") continue; // bare marks (the logo alone) have no silhouette
      expect(seen.get(body), badge.id).toBeUndefined();
      seen.set(body, badge.id);
    }
  });

  it("keeps the feather's shaft visible on light themes", () => {
    expect(draw("plus").innerHTML).not.toContain("#fff4fa");
  });
});
