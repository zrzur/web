import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Action = { text: unknown; onClick?: () => unknown; variant?: string };

vi.mock("@revolt/ui", () => ({
  Dialog: (props: {
    show: boolean;
    children?: unknown;
    error?: unknown;
    actions?: Action[];
  }) => (
    <>
      {props.show ? (
        <div role="dialog">
          {props.children as never}
          {props.error as never}
          <For each={props.actions ?? []}>
            {(action) => (
              <button
                data-variant={action.variant ?? "secondary"}
                onClick={() => action.onClick?.()}
              >
                {action.text as never}
              </button>
            )}
          </For>
        </div>
      ) : null}
    </>
  ),
  TextField: (props: {
    value?: string;
    error?: string | false;
    onInput?: (event: { currentTarget: HTMLTextAreaElement }) => void;
  }) => (
    <label>
      <textarea
        data-reason
        value={props.value ?? ""}
        onInput={(event) => props.onInput?.(event)}
      />
      {props.error ? <span data-field-error>{props.error}</span> : null}
    </label>
  ),
}));
vi.mock("@revolt/client", () => ({ useClient: () => () => ({}) }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: { type?: string } }) => (
    <span data-plain>
      plain words
      <details>
        <summary>Details</summary>
        <code>{props.error?.type}</code>
      </details>
    </span>
  ),
}));
const erase = vi.fn();
vi.mock("./communityApi", () => ({
  communityApi: { erase: (...args: unknown[]) => erase(...args) },
}));

import { StaffEraseDialog } from "./StaffErase";

let dispose: (() => void) | undefined;
let erased: string[] = [];

const confirm = () =>
  document.querySelector<HTMLButtonElement>('[data-variant="destructive"]')!;
const type = (text: string) => {
  const field = document.querySelector<HTMLTextAreaElement>("[data-reason]")!;
  field.value = text;
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
};
const settle = () => new Promise((done) => setTimeout(done, 0));

beforeEach(() => {
  erase.mockReset();
  erased = [];
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <StaffEraseDialog
          show
          item={{ _id: "item1", name: "Rose ring", version: 4 }}
          onClose={() => undefined}
          onErased={(id) => erased.push(id)}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
});
afterEach(() => dispose?.());

describe("StaffEraseDialog", () => {
  it("says it is for good and that the creator is told", () => {
    const text = document.body.textContent ?? "";
    expect(text).toContain("Rose ring");
    expect(text).toContain("deleted for good");
    expect(text).toContain("The creator is told why");
  });

  it("needs a reason before it asks the server", async () => {
    confirm().click();
    await settle();
    expect(erase).not.toHaveBeenCalled();
    expect(document.querySelector("[data-field-error]")).not.toBeNull();

    type("   ");
    confirm().click();
    await settle();
    expect(erase).not.toHaveBeenCalled();
  });

  it("sends the reason and the version, then reports the design gone", async () => {
    erase.mockResolvedValue(undefined);
    type("Copied art");
    confirm().click();
    await settle();
    expect(erase).toHaveBeenCalledWith(
      expect.anything(),
      "item1",
      "Copied art",
      4,
    );
    expect(erased).toEqual(["item1"]);
  });

  it("shows a refusal in plain words with the type under Details", async () => {
    erase.mockRejectedValue(JSON.stringify({ type: "CommunityItemConflict" }));
    type("Copied art");
    confirm().click();
    await settle();
    const shown = document.querySelector('[data-testid="staff-erase-error"]');
    expect(shown?.textContent).toContain("plain words");
    expect(shown?.querySelector("code")?.textContent).toBe(
      "CommunityItemConflict",
    );
    expect(erased).toEqual([]);
  });
});
