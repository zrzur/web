import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import type { JSX } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRIVILEGED_INTENTS, PrivilegedIntents } from "./PrivilegedIntents";

// Docs gap 17: an owner switched Message Content on twice and could not
// tell whether it was saved. The switch must show what the server saved,
// confirm it, and say when it counts.

vi.mock("@revolt/ui", () => ({
  SettingsSection: (props: {
    description?: JSX.Element;
    children?: JSX.Element;
  }) => (
    <section>
      <p>{props.description}</p>
      {props.children}
    </section>
  ),
  SettingsRow: (props: {
    title?: JSX.Element;
    description?: JSX.Element;
    control?: (ids: { labelId: string; descriptionId: string }) => JSX.Element;
  }) => (
    <div data-row>
      <strong>{props.title}</strong>
      <span>{props.description}</span>
      {props.control?.({ labelId: "l", descriptionId: "d" })}
    </div>
  ),
  Toggle: (props: {
    checked: boolean;
    disabled?: boolean;
    onChange?: (checked: boolean) => void;
  }) => (
    <button
      role="switch"
      aria-checked={props.checked}
      disabled={props.disabled}
      onClick={() => props.onChange?.(!props.checked)}
    />
  ),
  Button: (props: { children?: JSX.Element; onPress?: () => void }) => (
    <button onClick={() => props.onPress?.()}>{props.children}</button>
  ),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: { type?: string } }) => (
    <span data-server-error>{props.error?.type ?? "error"}</span>
  ),
}));

let dispose: (() => void) | undefined;
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => dispose?.());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const switches = () => [
  ...document.querySelectorAll<HTMLButtonElement>('[role="switch"]'),
];

function mount(
  load: () => Promise<number>,
  save: (n: number) => Promise<number>,
) {
  const onChange = vi.fn();
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <PrivilegedIntents load={load} save={save} onChange={onChange} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return onChange;
}

describe("privileged intents", () => {
  it("shows the saved state, not a guess, while loading and after", async () => {
    let resolve!: (n: number) => void;
    mount(
      () => new Promise((r) => (resolve = r)),
      async (n) => n,
    );
    // nothing to flip before the saved state is known
    expect(switches().every((s) => s.disabled)).toBe(true);
    resolve(PRIVILEGED_INTENTS.serverMembers);
    await tick();
    expect(switches().map((s) => s.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(document.body.textContent).toContain("On (saved)");
  });

  it("saves at once, shows what the server answered and when it counts", async () => {
    let stored = 0;
    const save = vi.fn(async (n: number) => (stored = n));
    const onChange = mount(async () => stored, save);
    await tick();
    switches()[0].click();
    await tick();
    await tick();
    expect(save).toHaveBeenCalledWith(PRIVILEGED_INTENTS.messageContent);
    expect(switches()[0].getAttribute("aria-checked")).toBe("true");
    expect(onChange).toHaveBeenLastCalledWith(
      PRIVILEGED_INTENTS.messageContent,
    );
    expect(document.querySelector('[role="status"]')?.textContent).toBe(
      "Saved: Message content is on. It counts from the bot's next connection.",
    );
    expect(document.body.textContent).toContain(
      "applies from the bot's next connection",
    );
  });

  it("saves the intended mask from the saved state, never switching others off", async () => {
    let stored: number = PRIVILEGED_INTENTS.serverMembers;
    const save = vi.fn(async (n: number) => (stored = n));
    mount(async () => stored, save);
    await tick();
    switches()[0].click();
    await tick();
    await tick();
    expect(save).toHaveBeenLastCalledWith(
      PRIVILEGED_INTENTS.serverMembers | PRIVILEGED_INTENTS.messageContent,
    );
    switches()[0].click();
    await tick();
    await tick();
    expect(save).toHaveBeenLastCalledWith(PRIVILEGED_INTENTS.serverMembers);
  });

  it("reads the switches again after saving and shows that", async () => {
    let stored = 0;
    const load = vi.fn(async () => stored);
    mount(load, async (n) => {
      stored = n;
      // an answer that lags behind must not decide what is shown
      return 0;
    });
    await tick();
    switches()[0].click();
    await tick();
    await tick();
    expect(load).toHaveBeenCalledTimes(2);
    expect(switches()[0].getAttribute("aria-checked")).toBe("true");
  });

  it("keeps the switch on the saved value when saving fails", async () => {
    mount(
      async () => 0,
      async () => {
        throw { type: "FailedValidation" };
      },
    );
    await tick();
    switches()[0].click();
    await tick();
    expect(switches()[0].getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "FailedValidation",
    );
  });

  it("says so when the saved state cannot be read, and tries again", async () => {
    let fail = true;
    mount(
      async () => {
        if (fail) throw { type: "InternalError" };
        return PRIVILEGED_INTENTS.presence;
      },
      async (n) => n,
    );
    await tick();
    expect(switches()).toHaveLength(0);
    expect(document.body.textContent).toContain(
      "Couldn't load the saved intents.",
    );
    fail = false;
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Try again")!
      .click();
    await tick();
    expect(switches()[2].getAttribute("aria-checked")).toBe("true");
  });
});
