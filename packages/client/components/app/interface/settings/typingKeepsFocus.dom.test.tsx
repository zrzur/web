import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal, splitProps } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForumTags } from "./channel/ForumTags";
import { LobbyRoleQuestionsEditor } from "./server/LobbyRoleQuestionsEditor";

// Typing a full word into a list of fields must keep the value and the focus:
// replacing the row objects (or a rebuilt row) used to drop the field after
// one character.

vi.mock("@revolt/ui", () => {
  const Box = (props: { children?: unknown }) => (
    <div>{props.children as never}</div>
  );
  return {
    Button: (props: Record<string, unknown>) => {
      const [local, rest] = splitProps(props, [
        "children",
        "onPress",
        "size",
        "variant",
      ]);
      return (
        <button
          {...(rest as object)}
          onClick={() => (local.onPress as (() => void) | undefined)?.()}
        >
          {local.children as never}
        </button>
      );
    },
    IconButton: (props: Record<string, unknown>) => {
      const [local, rest] = splitProps(props, [
        "children",
        "onPress",
        "size",
        "variant",
      ]);
      return (
        <button
          {...(rest as object)}
          onClick={() => (local.onPress as (() => void) | undefined)?.()}
        >
          {local.children as never}
        </button>
      );
    },
    Column: Box,
    SettingsSection: (props: { children?: unknown }) => (
      <section>{props.children as never}</section>
    ),
    SettingsRow: (props: { title?: unknown; onClick?: () => void }) => (
      <div role="button" tabindex="0" onClick={() => props.onClick?.()}>
        {props.title as never}
      </div>
    ),
    SettingsSaveBar: () => null,
    Toggle: () => <input type="checkbox" />,
    FloatingSelect: Box,
    MenuItem: Box,
    TextField: (props: Record<string, unknown>) => {
      const [, rest] = splitProps(props, ["error", "label", "maxlength"]);
      return (
        <input
          {...(rest as object)}
          maxlength={props.maxlength as number}
          aria-label={(props["aria-label"] ?? props.label) as string}
        />
      );
    },
  };
});
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/client", () => ({ useUser: () => () => ({ id: "u" }) }));
vi.mock("@revolt/i18n", () => ({ useError: () => () => "error" }));
vi.mock("@revolt/markdown/emoji", () => ({ Emoji: () => <span /> }));
vi.mock(
  "@revolt/ui/components/features/messaging/composition/picker/CompositionMediaPicker",
  () => ({
    CompositionMediaPicker: (props: { children: (p: unknown) => unknown }) =>
      props.children({
        ref: () => undefined,
        onClickEmoji: () => undefined,
      }) as never,
  }),
);

let dispose: (() => void) | undefined;
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => dispose?.());

/** Type one character at a time, the way a keyboard does */
function typeWord(input: HTMLInputElement, word: string) {
  for (const char of word) {
    input.value += char;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: char }));
  }
}

describe("typing a full word", () => {
  it("keeps value and focus in a forum tag name", () => {
    const channel = {
      forum: { tags: [{ id: "t1", name: "" }], requireTag: false },
      edit: vi.fn(),
    };
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <ForumTags channel={channel as never} />
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    const input = document.querySelector<HTMLInputElement>(
      "[data-tag-row] input",
    )!;
    input.focus();
    typeWord(input, "Bug reports");
    const after = document.querySelector<HTMLInputElement>(
      "[data-tag-row] input",
    )!;
    expect(after).toBe(input);
    expect(after.value).toBe("Bug reports");
    expect(document.activeElement).toBe(input);
  });

  it("keeps value and focus in a lobby question and its answer", () => {
    const [questions, setQuestions] = createSignal([
      {
        id: "q1",
        question: "",
        options: [{ id: "o1", label: "", role: "" }],
      },
    ]);
    const server = {
      havePermission: () => true,
      orderedRoles: [],
      roles: new Map(),
      member: { roles: [] },
      ownerId: "u",
    };
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <LobbyRoleQuestionsEditor
            server={server as never}
            questions={questions() as never}
            onChange={(value) => setQuestions(value as never)}
          />
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    for (const [selector, word] of [
      ['input[aria-label="Question"]', "Gaming"],
      ['input[aria-label^="Answer"]', "Players"],
    ] as const) {
      const input = document.querySelector<HTMLInputElement>(selector)!;
      input.focus();
      typeWord(input, word);
      const after = document.querySelector<HTMLInputElement>(selector)!;
      expect(after).toBe(input);
      expect(after.value).toBe(word);
      expect(document.activeElement).toBe(input);
    }
  });

  it("moves focus through the remove confirmation: Keep, Escape, Remove", async () => {
    const channel = {
      forum: {
        tags: [
          { id: "t1", name: "One" },
          { id: "t2", name: "Two" },
          { id: "t3", name: "Three" },
        ],
        requireTag: false,
      },
      edit: vi.fn(),
    };
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <ForumTags channel={channel as never} />
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    const tick = () => new Promise((r) => setTimeout(r, 10));
    const trash = (id: string) =>
      document.querySelector<HTMLElement>(`[data-trash-tag="${id}"]`)!;
    const press = (label: string) =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent?.trim() === label)!
        .click();

    // the confirmation takes focus on the safe choice
    trash("t2").click();
    await tick();
    expect(document.activeElement).toBe(
      document.querySelector("[data-keep-tag]"),
    );
    // Keep: back to the trash button it came from
    press("Keep");
    await tick();
    expect(document.activeElement).toBe(trash("t2"));

    // Escape cancels the confirmation and nothing else
    trash("t2").click();
    await tick();
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    const bodySeen = vi.fn();
    document.body.addEventListener("keydown", bodySeen);
    document.activeElement!.dispatchEvent(escape);
    document.body.removeEventListener("keydown", bodySeen);
    await tick();
    expect(bodySeen).not.toHaveBeenCalled();
    expect(document.querySelector("[data-keep-tag]")).toBeNull();
    expect(document.activeElement).toBe(trash("t2"));

    // Remove: focus lands on the next row's trash button
    trash("t2").click();
    await tick();
    press("Remove");
    await tick();
    expect(document.querySelector('[data-trash-tag="t2"]')).toBeNull();
    expect(document.activeElement).toBe(trash("t3"));

    // removing the last row falls back to "Add tag"
    trash("t3").click();
    await tick();
    press("Remove");
    await tick();
    expect(document.activeElement?.textContent).toContain("Add tag");
  });
});
