import { afterEach, describe, expect, it } from "vitest";

import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import { formatKeymap } from "./formatKeys";

let view: EditorView | undefined;
afterEach(() => view?.destroy());

/** An editor like the message box: our keys, then CodeMirror's own keymap */
function editor(doc: string, from: number, to: number) {
  const parent = document.createElement("div");
  document.body.append(parent);
  view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(from, to),
      // the message box lists its own keys after CodeMirror's: order alone
      // must not decide
      extensions: [keymap.of(defaultKeymap), markdown(), formatKeymap(false)],
    }),
  });
  return view;
}

const press = (target: EditorView, init: KeyboardEventInit) =>
  target.contentDOM.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  );

describe("formatting keys in the editor", () => {
  it("Ctrl+I makes italic, not CodeMirror's select-parent-syntax", () => {
    const v = editor("say hi now", 4, 6);
    press(v, { key: "i", code: "KeyI", ctrlKey: true });
    expect(v.state.doc.toString()).toBe("say *hi* now");
    expect(
      v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to),
    ).toBe("hi");
  });

  it("Ctrl+B makes bold, and again takes it off", () => {
    const v = editor("say hi now", 4, 6);
    press(v, { key: "b", code: "KeyB", ctrlKey: true });
    expect(v.state.doc.toString()).toBe("say **hi** now");
    press(v, { key: "b", code: "KeyB", ctrlKey: true });
    expect(v.state.doc.toString()).toBe("say hi now");
  });

  it("matches the key's place: an Arabic layout's Ctrl+ت is Ctrl+B", () => {
    const v = editor("مرحبا", 0, 5);
    press(v, { key: "لا", code: "KeyB", ctrlKey: true });
    expect(v.state.doc.toString()).toBe("**مرحبا**");
  });

  it("leaves a character being composed alone (key code 229)", () => {
    const v = editor("hi", 0, 2);
    press(v, { key: "Process", code: "KeyI", ctrlKey: true, keyCode: 229 });
    expect(v.state.doc.toString()).toBe("hi");
  });
});
