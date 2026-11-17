import { describe, expect, it } from "vitest";

// @ts-expect-error a build script in CommonJS, without types
import hoverOnly from "./postcssHoverOnly.cjs";

const { splitHover, withoutHover } = hoverOnly as {
  splitHover: (selectors: string[]) => { hover: string[]; touch: string[] };
  withoutHover: (selector: string) => string | null;
};

describe("hover styles only where hovering exists", () => {
  it("leaves a selector that does not depend on hovering", () => {
    expect(withoutHover(".row:focus-visible")).toBe(".row:focus-visible");
    expect(splitHover([".row", ".row:active"])).toEqual({
      hover: [],
      touch: [".row", ".row:active"],
    });
  });

  it("a hover rule is for devices that hover, the rest stays for all", () => {
    expect(splitHover([".row:hover", ".row:focus-visible"])).toEqual({
      hover: [".row:hover"],
      touch: [".row:focus-visible"],
    });
    expect(splitHover(["a:hover > .mark"])).toEqual({
      hover: ["a:hover > .mark"],
      touch: [],
    });
  });

  it("a list keeps its other entries on touch screens", () => {
    const selector =
      ".row[data-tools='true']:is(:hover, :focus-within, [data-active='true']) .tools";
    expect(splitHover([selector])).toEqual({
      hover: [selector],
      touch: [
        ".row[data-tools='true']:is(:focus-within, [data-active='true']) .tools",
      ],
    });
  });

  it("a list of hovering alone has nothing for touch screens", () => {
    expect(splitHover([".a:is(:hover) .b"])).toEqual({
      hover: [".a:is(:hover) .b"],
      touch: [],
    });
  });

  it("'not hovered' is true on touch screens: left alone", () => {
    expect(withoutHover(".card:not(:hover) .more")).toBe(
      ".card:not(:hover) .more",
    );
    expect(splitHover([".bar:not(:hover):not(:focus-within)"])).toEqual({
      hover: [],
      touch: [".bar:not(:hover):not(:focus-within)"],
    });
  });

  it("hovered and not disabled is still a hover rule", () => {
    expect(splitHover([".b:hover:not([aria-disabled='true'])"])).toEqual({
      hover: [".b:hover:not([aria-disabled='true'])"],
      touch: [],
    });
  });
});
