import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For, Show } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// "Remind me": a ready-made time sets the reminder at once, a refusal stays
// in the dialog, and changing a reminder moves it instead of adding one.

type Action = { text: unknown; onClick?: () => unknown };

vi.mock("@revolt/ui", () => ({
  Dialog: (props: {
    children?: unknown;
    error?: unknown;
    actions?: Action[];
    onClose: () => void;
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
            onClick={() => {
              const value = action.onClick?.();
              if (value instanceof Promise)
                value.then(props.onClose).catch(() => {});
              else props.onClose();
            }}
          >
            {action.text as never}
          </button>
        )}
      </For>
    </div>
  ),
  DateTimeField: (props: { value?: Date }) => (
    <div data-custom-field>{props.value?.toISOString()}</div>
  ),
  useSnackbar: () => ({ show: snackbar }),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/ui/components/design/dateTime", () => ({
  hour12From: () => false,
}));
vi.mock("@revolt/i18n", () => ({
  timeLocale: () => [undefined, { formats: { LT: "HH:mm" } }],
  useTime: () => () => ({ format: () => "time", calendar: () => "then" }),
}));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: { type?: string } }) => (
    <span>{props.error.type}</span>
  ),
}));
vi.mock("@revolt/client", () => ({ useClient: () => () => client }));

import { RemindMessageModal } from "./RemindMessage";

const snackbar = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const client = {
  api: { post, patch },
  markdownToText: (text: string) => text,
};
const message = { id: "MSG1", content: "call the bank" };

let dispose: (() => void) | undefined;
let closed = 0;
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  closed = 0;
  post.mockReset();
  patch.mockReset();
  snackbar.mockReset();
});
afterEach(() => dispose?.());

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function open(reminder?: { _id: string; due_at: number }) {
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <RemindMessageModal
          type="remind_message"
          message={message as never}
          reminder={reminder}
          show
          onClose={() => closed++}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
}

const choice = (preset: string) =>
  document.querySelector<HTMLButtonElement>(`[data-preset="${preset}"]`)!;

it("offers the ready-made times and the message's words", () => {
  open();
  expect(choice("20m")).not.toBeNull();
  expect(choice("1h")).not.toBeNull();
  expect(choice("morning")).not.toBeNull();
  expect(choice("custom").getAttribute("aria-expanded")).toBe("false");
  expect(document.body.textContent).toContain("call the bank");
  // only Cancel until a time of one's own is being picked
  expect(document.querySelectorAll("[data-action]")).toHaveLength(1);
});

it("a ready-made time sets the reminder and closes", async () => {
  post.mockResolvedValue({ _id: "R1" });
  open();
  const before = Date.now();
  choice("1h").click();
  await settle();

  expect(post).toHaveBeenCalledTimes(1);
  const [path, body] = post.mock.calls[0];
  expect(path).toBe("/users/@me/reminders");
  expect(body.message).toBe("MSG1");
  expect(body.due_at - before).toBeGreaterThanOrEqual(60 * 60_000 - 1000);
  expect(body.due_at - before).toBeLessThan(60 * 60_000 + 5000);
  expect(closed).toBe(1);
  expect(snackbar).toHaveBeenCalledTimes(1);
});

it("a refusal stays in the dialog, in words", async () => {
  post.mockRejectedValue({ type: "TooManyReminders", max: 10 });
  open();
  choice("20m").click();
  await settle();

  expect(closed).toBe(0);
  expect(document.querySelector('[role="alert"]')!.textContent).toContain(
    "TooManyReminders",
  );
  expect(snackbar).not.toHaveBeenCalled();
});

it("picking a time shows the field and the button that sets it", async () => {
  post.mockResolvedValue({ _id: "R1" });
  open();
  choice("custom").click();
  expect(document.querySelector("[data-custom-field]")).not.toBeNull();
  const actions = document.querySelectorAll<HTMLButtonElement>("[data-action]");
  expect(actions).toHaveLength(2);
  actions[1].click();
  await settle();
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1].due_at).toBeGreaterThan(Date.now());
  expect(closed).toBe(1);
});

it("changing a reminder moves it and adds none", async () => {
  patch.mockResolvedValue({ _id: "R9" });
  const due = Date.now() + 3 * 60 * 60_000;
  open({ _id: "R9", due_at: due });
  // the field is open on the reminder's own time
  expect(document.querySelector("[data-custom-field]")!.textContent).toBe(
    new Date(due).toISOString(),
  );
  choice("1h").click();
  await settle();

  expect(post).not.toHaveBeenCalled();
  expect(patch).toHaveBeenCalledTimes(1);
  expect(patch.mock.calls[0][0]).toBe("/users/@me/reminders/R9");
  expect(closed).toBe(1);
});

it("a time that has passed is refused before anything is sent", async () => {
  open({ _id: "R9", due_at: Date.now() - 60_000 });
  document.querySelectorAll<HTMLButtonElement>("[data-action]")[1].click();
  await settle();
  expect(patch).not.toHaveBeenCalled();
  expect(closed).toBe(0);
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});
