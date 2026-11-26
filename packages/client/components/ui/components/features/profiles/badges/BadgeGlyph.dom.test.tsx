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
    // Founder and Staff are both the Zrzur mark on its own, told apart by
    // colour only (owner, 2026-11-12), and the cancelled Verified Server Owner
    // keeps the one verified seal for people who have it (owner, 2026-11-24)
    const sameMark = new Set(["founder", "staff", "verified_server_owner"]);
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

  it("draws Verified Bot Developer as its own badge, not the verified seal", () => {
    // owner 2026-11-24: the two verified badges were the same grey seal in My
    // Badges; he picked the </> in a gear for Verified Bot Developer. The
    // server and bot marks keep the one verified seal (owner, 2026-11-12).
    const outline = (id: string) =>
      draw(id).querySelector("clipPath path")?.getAttribute("d") ?? "";
    const developer = outline("verified_bot_developer");
    const seal = outline("server_verified");
    expect(developer).not.toBe("");
    expect(developer).not.toBe(seal);
    expect(developer).not.toBe(outline("verified_server_owner"));
    expect(outline("bot_verified")).toBe(seal);
  });

  it("draws Early Adopter as a ticket, never the Zrzur mark of the team", () => {
    // owner 2026-11-25: the mark in pink-red read as "works for Zrzur" next
    // to Founder and Staff; he picked the cream admission ticket printed 01
    const outline = (id: string) =>
      draw(id).querySelector("clipPath path")?.getAttribute("d") ?? "";
    const ticket = outline("early_adopter");
    expect(ticket).not.toBe("");
    expect(ticket).not.toBe(outline("founder"));
    expect(ticket).not.toBe(outline("staff"));
    // nothing of Founder's gold, so "01" never reads as "the founder"
    const html = draw("early_adopter").innerHTML.toUpperCase();
    for (const gold of ["#FFF3C4", "#F0C55A", "#C68A22", "#8A5A12"])
      expect(html).not.toContain(gold);
  });

  it("keeps the feather's shaft visible on light themes", () => {
    expect(draw("plus").innerHTML).not.toContain("#fff4fa");
  });
});
