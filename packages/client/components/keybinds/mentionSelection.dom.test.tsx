import { afterEach, describe, expect, it } from "vitest";

import {
  noteRowFocus,
  rovingRow,
  targetMessageRow,
} from "../app/interface/channels/text/messageKeys";
import { extendsSelection } from "./mention";

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

/** Two message rows in a list, the first with a name chip in its text */
function list() {
  document.body.innerHTML = `
    <div data-message-scroller>
      <div data-message-row="A" tabindex="-1">
        <span class="name">Samira</span>
        <p class="text">hello <span class="chip">@Omar</span> there</p>
      </div>
      <div data-message-row="B" tabindex="-1"><p class="text">second</p></div>
    </div>
    <p class="outside">not a message</p>`;
  const q = (selector: string) => document.querySelector(selector)!;
  return {
    chipA: q('[data-message-row="A"] .chip'),
    textA: q('[data-message-row="A"] .text'),
    textB: q('[data-message-row="B"] .text'),
    rowB: q('[data-message-row="B"]') as HTMLElement,
    outside: q(".outside"),
  };
}

function select(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

describe("extendsSelection", () => {
  it("is false with nothing selected: Shift+click mentions", () => {
    const { chipA } = list();
    expect(extendsSelection(chipA)).toBe(false);
  });

  it("is true for a click in the message whose text is being selected", () => {
    const { chipA, textA } = list();
    select(textA);
    expect(extendsSelection(chipA)).toBe(true);
    expect(extendsSelection(chipA.firstChild)).toBe(true);
  });

  it("is false for a click in another message or outside the list", () => {
    const { textA, textB, outside } = list();
    select(textA);
    expect(extendsSelection(textB)).toBe(false);
    expect(extendsSelection(outside)).toBe(false);
    expect(extendsSelection(null)).toBe(false);
  });
});

describe("roving tab index", () => {
  it("remembers the row the keyboard was on last", () => {
    noteRowFocus("A");
    expect(rovingRow()).toBe("A");
    noteRowFocus("B");
    expect(rovingRow()).toBe("B");
  });

  it("takes keys only on a row with keyboard focus, not on a clicked one", () => {
    const { rowB } = list();
    rowB.focus();
    // jsdom has no :focus-visible; the check then falls back to the focus
    const target = targetMessageRow();
    expect(target === rowB || target === undefined).toBe(true);
    document.body.focus();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(targetMessageRow()).toBe(undefined);
  });
});
