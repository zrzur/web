/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const fake: any = {
  serverEvents: { create, edit: vi.fn() },
  uploadFile: vi.fn(),
  user: { id: "me" },
  users: {
    get: (id: string) =>
      id === "sara" ? { id, displayName: "Sara" } : undefined,
    fetch: async () => undefined,
  },
};

vi.mock("solid-forms", async () => {
  const { createSignal } = await import("solid-js");
  return {
    createFormControl: (initial: unknown) => {
      const [value, setValue] = createSignal(initial);
      return {
        get value() {
          return value();
        },
        setValue,
      };
    },
    createFormGroup: (controls: unknown) => ({ controls, isPending: false }),
  };
});
vi.mock("@revolt/client", () => ({ useClient: () => () => fake }));
vi.mock("@revolt/i18n", () => ({
  timeLocale: () => ["en", { formats: { LT: "HH:mm" } }],
}));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: unknown }) => (
    <span>{String(props.error)}</span>
  ),
}));
vi.mock("@revolt/instance", () => ({
  useInstance: () => ({
    mediaUrl: "",
    limits: () => ({ file_upload_size_limits: { banners: 1 } }),
  }),
}));
vi.mock("@revolt/routing", () => ({ useNavigate: () => vi.fn() }));
vi.mock("..", () => ({ useModals: () => ({ openModal: vi.fn() }) }));
vi.mock("./CropProcess", () => ({ cropProcess: () => undefined }));
vi.mock("@revolt/ui/components/design/dateTime", () => ({
  hour12From: () => false,
  roundUp: (date: Date) => date,
}));
vi.mock("@revolt/ui", () => {
  const Field = (props: any) => (
    <input
      aria-label={props.label}
      value={props.control?.value ?? ""}
      onInput={(e) => props.control?.setValue(e.currentTarget.value)}
    />
  );
  return {
    Dialog: (props: any) => (
      <div role="dialog">
        {props.children}
        <For each={props.actions}>
          {(action: any) => (
            <button
              type="button"
              disabled={action.isDisabled}
              onClick={() => action.onClick?.()}
            >
              {action.text}
            </button>
          )}
        </For>
      </div>
    ),
    DateTimeField: () => <span />,
    FloatingSelect: (props: any) => <div>{props.children}</div>,
    MenuItem: (props: any) => <span>{props.children}</span>,
    Segmented: (props: any) => (
      <For each={props.options}>
        {(option: any) => (
          <button type="button" onClick={() => props.onChange(option.value)}>
            {option.label}
          </button>
        )}
      </For>
    ),
    Avatar: () => <span />,
    TextField: (props: any) => (
      <input
        data-testid={props["data-testid"]}
        aria-label={props.label}
        value={props.value ?? ""}
        onInput={(e) => props.onInput?.(e)}
      />
    ),
    Toggle: () => <span />,
    Checkbox: (props: any) => <label>{props.children}</label>,
    Form2: {
      TextField: Field,
      FileInput: () => <span />,
      canSubmit: () => true,
      useSubmitHandler: (_group: unknown, submit: () => void) => (e: Event) => {
        e.preventDefault();
        submit();
      },
    },
  };
});

const { ServerEventEditorModal } = await import("./ServerEventEditor");

const server: any = {
  id: "server",
  // the server's search knows usernames only; the display name is matched
  // against the first members
  queryMembersExperimental: async () => ({ members: [], users: [] }),
  fetchMembersPage: async () => ({
    members: [],
    users: [
      { id: "sara", displayName: "Sara", username: "user1" },
      { id: "omar", displayName: "Omar", username: "user2" },
    ],
  }),
  channels: [
    { id: "voice", name: "Voice", isVoice: true, havePermission: () => true },
  ],
};

let dispose: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  create.mockReset();
  create.mockImplementation(
    () =>
      new Promise((resolve) => setTimeout(() => resolve({ _id: "new" }), 20)),
  );
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ServerEventEditor", () => {
  it("schedules one event however often Publish is pressed", async () => {
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <ServerEventEditorModal
            type="server_event"
            server={server}
            show
            onClose={() => undefined}
          />
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    const title = document.querySelector<HTMLInputElement>(
      "input[aria-label=Title]",
    )!;
    title.value = "Game night";
    title.dispatchEvent(new InputEvent("input", { bubbles: true }));
    const schedule = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Publish",
    )!;
    schedule.click();
    schedule.click();
    // Enter in the form too
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush(50);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1].time_zone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it("an invited-only event needs someone invited, and sends who it is", async () => {
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <ServerEventEditorModal
            type="server_event"
            server={server}
            show
            onClose={() => undefined}
          />
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    const press = (text: string) =>
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent === text)!
        .click();
    const title = document.querySelector<HTMLInputElement>(
      "input[aria-label=Title]",
    )!;
    title.value = "Team night";
    title.dispatchEvent(new InputEvent("input", { bubbles: true }));
    press("Invited only");
    await flush();
    press("Publish");
    await flush(50);
    expect(create).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-testid=server-event-problem]")!.textContent,
    ).toContain("Choose at least one person to invite.");

    const search = document.querySelector<HTMLInputElement>(
      "[data-testid=server-event-invited-search]",
    )!;
    search.value = "sa";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await flush(320);
    document
      .querySelector<HTMLButtonElement>(
        "[data-testid=server-event-invited-result]",
      )!
      .click();
    await flush();
    expect(
      document.querySelector("[data-testid=server-event-invited-chosen]")!
        .textContent,
    ).toContain("Sara");
    press("Publish");
    await flush(50);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1].visibility).toBe("Invited");
    expect(create.mock.calls[0][1].invited).toEqual(["sara"]);
  });
});
