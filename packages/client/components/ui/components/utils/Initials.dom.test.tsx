import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { Initials, initialsText, toInitials } from "./Initials";

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

  it("skips the Arabic definite article", () => {
    expect(toInitials("مكتبة الأصدقاء")).toEqual(["م", "أ"]);
    expect(toInitials("الكتاب")).toEqual(["ك"]);
    // «ال» that is the word itself, or most of it, stays
    expect(toInitials("الم")).toEqual(["ا"]);
    expect(toInitials("آل سعيد")).toEqual(["آ", "س"]);
  });

  it("drops vowel marks and tatweel, and keeps whole characters", () => {
    expect(toInitials("هُدَى")).toEqual(["ه"]);
    expect(toInitials("ـمرحبا")).toEqual(["م"]);
    expect(toInitials("😀 fun")).toEqual(["😀", "f"]);
  });

  it("keeps Arabic initials from joining into a word", () => {
    expect(initialsText("مكتبة الأصدقاء")).toBe("م\u200Cأ");
    expect(initialsText("Speed test")).toBe("St");
    expect(initialsText("Zrzur عربي")).toBe("Z\u200Cع");
  });
});
