import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// the real form; the design kit's field as a plain input
vi.mock("@revolt/ui", () => ({
  TextField: (props: Record<string, unknown>) => (
    <label>
      {props.label as string}
      <input
        name={props.name as string}
        required={props.required as boolean}
        inputmode={props.inputmode as "numeric"}
      />
    </label>
  ),
  Button: (props: Record<string, unknown>) => (
    <button
      type={(props.type as "submit") ?? "button"}
      onClick={() => (props.onPress as (() => void) | undefined)?.()}
    >
      {props.children as never}
    </button>
  ),
  BirthMonthField: () => null,
  Checkbox: () => null,
}));
vi.mock("@revolt/routing", () => ({
  A: (p: { children: unknown }) => p.children,
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <i /> }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (p: { error: unknown }) => <>{String(p.error)}</>,
}));
vi.mock("./Turnstile", () => ({ default: () => null }));

import { type MfaAsk, FlowMfaStep } from "./FlowMfaStep";

let dispose: (() => void) | undefined;
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
});
afterEach(() => dispose?.());

function mount(ask: MfaAsk) {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <FlowMfaStep ask={ask} />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}
const input = () =>
  document.querySelector<HTMLInputElement>('input[name="code"]')!;
const send = async (code: string) => {
  input().value = code;
  document
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("the code step in the sign-in card", () => {
  it("asks for the authenticator code in the card, no dialog", () => {
    mount({ methods: ["Totp", "Recovery"], submit: vi.fn(), done: vi.fn() });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toContain("Confirm it's you");
    expect(input().getAttribute("inputmode")).toBe("numeric");
  });

  it("keeps a wrong code here with its message, ready for the next", async () => {
    const done = vi.fn();
    const submit = vi.fn(async () => {
      throw "This code didn't work.";
    });
    mount({ methods: ["Totp"], submit, done });
    await send("123456");
    expect(submit).toHaveBeenCalledWith({ totp_code: "123456" });
    expect(done).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "This code didn't work.",
    );
    expect(input().value).toBe("");
  });

  it("sends a recovery code after switching, and ends with the outcome", async () => {
    const outcome = { type: "signedIn" } as never;
    const done = vi.fn();
    mount({
      methods: ["Totp", "Recovery"],
      submit: vi.fn(async () => outcome),
      done,
    });
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Use a recovery code instead")!
      .click();
    await send("abcd-efgh");
    expect(done).toHaveBeenCalledWith(outcome);
  });

  it("goes back to the password with nothing sent", () => {
    const done = vi.fn();
    const submit = vi.fn();
    mount({ methods: ["Totp"], submit, done });
    document.querySelector<HTMLButtonElement>("[data-back]")!.click();
    expect(done).toHaveBeenCalledWith();
    expect(submit).not.toHaveBeenCalled();
  });
});
