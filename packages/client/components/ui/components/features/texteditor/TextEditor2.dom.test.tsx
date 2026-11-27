import { createEffect, createSignal } from "solid-js";
import { render } from "solid-js/web";

import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/common", () => ({ useDevice: () => ({ isMobile: false }) }));
vi.mock("../../utils/autoComplete", () => ({}));
vi.mock("./codeMirrorAutoComplete", () => ({
  codeMirrorAutoComplete: () => [],
}));
vi.mock("./codeMirrorWidgets", () => ({ codeMirrorWidgets: () => [] }));
vi.mock("./codeMirrorCommand", () => ({ commandPlugins: [] }));
vi.mock("./codeMirrorMarks", () => ({ markPlugins: [] }));

import { TextEditor2 } from "./TextEditor2";

let dispose: (() => void) | undefined;

function mount(element: () => unknown) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(element as never, host);
  return host.querySelector(".cm-content")!;
}

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

describe("TextEditor2 on a channel switch", () => {
  it("leaves the editor alone when the text stays the same", async () => {
    const [initial, setInitial] = createSignal<readonly [string]>([""]);
    const dispatch = vi.spyOn(EditorView.prototype, "dispatch");
    mount(() => (
      <TextEditor2 initialValue={initial()} onChange={() => undefined} />
    ));
    dispatch.mockClear();

    setInitial([""]);
    await Promise.resolve();

    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });

  it("still replaces the text when it differs", async () => {
    const [initial, setInitial] = createSignal<readonly [string]>(["draft"]);
    const content = mount(() => (
      <TextEditor2 initialValue={initial()} onChange={() => undefined} />
    ));

    setInitial(["other"]);
    await Promise.resolve();

    expect(content.textContent).toBe("other");
  });

  it("updates the placeholder and the name in one step", async () => {
    const [placeholder, setPlaceholder] = createSignal("Message #general");
    const dispatch = vi.spyOn(EditorView.prototype, "dispatch");
    const content = mount(() => (
      <TextEditor2 placeholder={placeholder()} onChange={() => undefined} />
    ));
    // the first update also measures the font, once
    setPlaceholder("Message #clips");
    await Promise.resolve();
    dispatch.mockClear();

    setPlaceholder("Message #random");
    await Promise.resolve();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(content.getAttribute("aria-label")).toBe("Message #random");
    dispatch.mockRestore();
  });
});

describe("TextEditor2 with a value that arrives while it mounts", () => {
  // bug #13 of 2026-11-22: the profile editor copies the loaded bio into
  // `initialValue` from its own effect, which runs after the editor was
  // made with no text but before the editor's effects ran once; the bio
  // stayed out of the field (Reset brought it back)
  function Parent(props: { bio: string; onChange: (text: string) => void }) {
    const [initial, setInitial] = createSignal<readonly [string]>();
    createEffect(() => setInitial([props.bio]));
    return <TextEditor2 initialValue={initial()} onChange={props.onChange} />;
  }

  it("shows the value set before its first update", async () => {
    const content = mount(() => (
      <Parent bio="Answers questions." onChange={() => undefined} />
    ));
    await Promise.resolve();

    expect(content.textContent).toBe("Answers questions.");
  });

  it("does not dispatch on mount with a placeholder and a value", () => {
    const dispatch = vi.spyOn(EditorView.prototype, "dispatch");
    mount(() => (
      <TextEditor2
        placeholder="Something cool about me..."
        initialValue={["draft"]}
        onChange={() => undefined}
      />
    ));

    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });

  it("calls neither onChange nor onTyping on mount", async () => {
    const onChange = vi.fn();
    const onTyping = vi.fn();
    mount(() => (
      <TextEditor2
        placeholder="Message #general"
        initialValue={["draft"]}
        onChange={onChange}
        onTyping={onTyping}
      />
    ));
    await Promise.resolve();

    expect(onChange).not.toHaveBeenCalled();
    expect(onTyping).not.toHaveBeenCalled();
  });
});

describe("TextEditor2 accessible name", () => {
  it("takes the name from the placeholder and follows it", async () => {
    const [placeholder, setPlaceholder] = createSignal("Message #general");
    const content = mount(() => (
      <TextEditor2 placeholder={placeholder()} onChange={() => undefined} />
    ));
    expect(content.getAttribute("aria-label")).toBe("Message #general");

    setPlaceholder("Message #random");
    await Promise.resolve();
    expect(content.getAttribute("aria-label")).toBe("Message #random");
  });

  it("prefers an explicit name", () => {
    const content = mount(() => (
      <TextEditor2
        ariaLabel="Edit message"
        placeholder="Type here"
        onChange={() => undefined}
      />
    ));
    expect(content.getAttribute("aria-label")).toBe("Edit message");
  });
});

describe("TextEditor2 when it leaves the page", () => {
  it("destroys the editor, so its window listeners let the page go", () => {
    const destroy = vi.spyOn(EditorView.prototype, "destroy");
    mount(() => <TextEditor2 onChange={() => undefined} />);
    expect(destroy).not.toHaveBeenCalled();

    dispose?.();
    dispose = undefined;

    expect(destroy).toHaveBeenCalledTimes(1);
    destroy.mockRestore();
  });
});

describe("TextEditor2 Enter in a quote or a list", () => {
  it.each(["> quoted", ">>> quoted\nto the end", "- item", "1. item"])(
    "sends %j instead of starting a new line",
    (draft) => {
      const onComplete = vi.fn();
      const content = mount(() => (
        <TextEditor2
          initialValue={[draft]}
          onChange={() => undefined}
          onComplete={onComplete}
        />
      ));
      const view = EditorView.findFromDOM(content as HTMLElement)!;
      view.dispatch({ selection: { anchor: draft.length } });
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(view.state.doc.toString()).toBe(draft);
    },
  );
});
