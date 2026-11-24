import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For, Show } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The sign-in dialog sends the code itself: a refused code is said in the
// dialog, which stays open; it closes only when the step has ended.

type Action = {
  text: unknown;
  onClick?: () => unknown;
  isDisabled?: boolean;
  isLoading?: boolean;
};
type Control = { value: string; setValue: (value: string) => void };

vi.mock("@revolt/ui", () => {
  return {
    Dialog: (props: {
      children?: unknown;
      error?: unknown;
      actions?: Action[];
    }) => (
      <div data-dialog>
        {props.children as never}
        <Show when={props.error}>
          <p role="alert">{props.error as never}</p>
        </Show>
        <For each={props.actions}>
          {(action) => (
            <button
              data-action
              disabled={action.isDisabled || action.isLoading}
              aria-busy={action.isLoading || undefined}
              onClick={() => action.onClick?.()}
            >
              {action.text as never}
            </button>
          )}
        </For>
      </div>
    ),
    CategoryButton: (props: { children?: unknown; onClick: () => void }) => (
      <button onClick={() => props.onClick()}>{props.children as never}</button>
    ),
    CircularProgress: () => <span />,
    Column: (props: { children?: unknown }) => (
      <div>{props.children as never}</div>
    ),
    Text: (props: { children?: unknown }) => <p>{props.children as never}</p>,
    Form2: {
      TextField: (props: {
        control: Control;
        name: string;
        inputmode?: string;
        autocomplete?: string;
      }) => (
        <input
          name={props.name}
          inputmode={props.inputmode as never}
          autocomplete={props.autocomplete}
          value={props.control.value}
          onInput={(e) => props.control.setValue(e.currentTarget.value)}
        />
      ),
      canSubmit: () => true,
      useSubmitHandler: () => (e: Event) => e.preventDefault(),
    },
  };
});
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: Error }) => (
    <span>{props.error.message}</span>
  ),
}));
vi.mock("solid-forms", async () => {
  const { createSignal } = await import("solid-js");
  const control = (initial: string) => {
    const [value, setValue] = createSignal(initial);
    return {
      get value() {
        return value();
      },
      setValue,
    };
  };
  return {
    createFormControl: control,
    createFormGroup: (controls: Record<string, unknown>) => ({
      controls,
      isPending: false,
    }),
  };
});

import { MFAFlowModal } from "./MFAFlow";

let dispose: (() => void) | undefined;
let closed = 0;
const callback = vi.fn();

function open(submit: (response: unknown) => Promise<unknown>) {
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <MFAFlowModal
          type="mfa_flow"
          state="login"
          available_methods={["Totp", "Recovery"]}
          submit={submit as never}
          callback={callback}
          show
          onClose={() => closed++}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
}

const field = () =>
  document.querySelector<HTMLInputElement>('input[name="totp_code"]')!;
const confirm = () =>
  [...document.querySelectorAll<HTMLButtonElement>("[data-action]")].find(
    (button) => button.textContent === "Confirm",
  )!;
const type = (value: string) => {
  field().value = value;
  field().dispatchEvent(new InputEvent("input", { bubbles: true }));
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  closed = 0;
  callback.mockReset();
});
afterEach(() => dispose?.());

describe("the two-factor step of signing in", () => {
  it("asks for the code as a one-time code on a number pad", () => {
    open(async () => ({ type: "signedIn" }));
    expect(field().getAttribute("inputmode")).toBe("numeric");
    expect(field().getAttribute("autocomplete")).toBe("one-time-code");
  });

  it("a refused code is said in the dialog, which stays open and empty", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("This code didn't work."));
    open(submit);
    type("000000");
    confirm().click();
    await settle();

    expect(submit).toHaveBeenCalledWith({ totp_code: "000000" });
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "This code didn't work.",
    );
    expect(closed).toBe(0);
    expect(callback).not.toHaveBeenCalled();
    expect(field().value).toBe("");
  });

  it("closes with the outcome once the step ends", async () => {
    const outcome = { type: "signedIn", session: { result: "Success" } };
    open(async () => outcome);
    type("123456");
    confirm().click();
    await settle();

    expect(callback).toHaveBeenCalledWith(outcome);
    expect(closed).toBe(1);
  });

  it("sends once while the answer is on its way", async () => {
    let finish: (value: unknown) => void = () => {};
    const submit = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    open(submit);
    type("123456");
    confirm().click();
    confirm().click();
    expect(submit).toHaveBeenCalledOnce();
    finish({ type: "signedIn" });
    await settle();
  });

  it("a code typed while the answer is on its way is kept", async () => {
    let refuse: (error: Error) => void = () => {};
    open(() => new Promise((_, reject) => (refuse = reject)));
    type("000000");
    confirm().click();
    // the person already types the next code before the server answers
    type("123456");
    refuse(new Error("This code didn't work."));
    await settle();
    expect(field().value).toBe("123456");
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "This code didn't work.",
    );
  });

  it("cancelling ends the step with nothing", () => {
    open(async () => ({ type: "signedIn" }));
    const action = (text: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("[data-action]")]
        .find((button) => button.textContent === text)!
        .click();
    // two methods: Back goes to the list, Cancel leaves
    action("Back");
    expect(callback).not.toHaveBeenCalled();
    action("Cancel");
    expect(callback).toHaveBeenCalledWith();
    expect(closed).toBe(1);
  });
});
