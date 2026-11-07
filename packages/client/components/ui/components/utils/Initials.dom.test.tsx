import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { Initials, toInitials } from "./Initials";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

describe("Initials", () => {
  it("draws the letters without adding them to the text of a named control", () => {
    const host = document.createElement("a");
    host.setAttribute("aria-label", "Speed test");
    document.body.appendChild(host);
    dispose = render(() => <Initials input="Speed test" maxLength={2} />, host);

    expect(host.textContent).toBe("");
    expect(
      host.querySelector("[data-initials]")!.getAttribute("data-initials"),
    ).toBe("St");
  });

  it("takes the first letter of each word", () => {
    expect(toInitials("one two three", 2)).toEqual(["o", "t"]);
  });
});
