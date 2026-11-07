import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { BadgeGlyph } from "./BadgeGlyph";
import { BADGES, CONTEXT_BADGES, badgeMeta } from "./catalog";

let dispose: (() => void) | undefined;
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

  it("draws every glyph in white on the two badges with a spark or chevron", () => {
    const spark = [...draw("early_supporter").querySelectorAll("path")].at(-1)!;
    expect(spark.getAttribute("fill")).toBe("#fff");
    expect(draw("elite_bug_hunter").innerHTML).not.toContain("#F5D47A");
  });

  it("gives every badge still given out a silhouette of its own", () => {
    const seen = new Map<string, string>();
    for (const badge of BADGES.filter((b) => !b.retired)) {
      const body = draw(badge.id)
        .querySelector("clipPath path")!
        .getAttribute("d")!;
      expect(seen.get(body), badge.id).toBeUndefined();
      seen.set(body, badge.id);
    }
  });

  it("gives the paw four toes and a pad", () => {
    const body = draw("paw").querySelector("clipPath path")!.getAttribute("d")!;
    expect(body.match(/M/g)).toHaveLength(5);
  });

  it("keeps the feather's shaft visible on light themes", () => {
    expect(draw("plus").innerHTML).not.toContain("#fff4fa");
  });
});
