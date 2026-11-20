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
    limits: () => ({ file_upload_size_limits: { banners: 1_000_000 } }),
  }),
}));
vi.mock("@revolt/routing", () => ({ useNavigate: () => vi.fn() }));
vi.mock("..", () => ({ useModals: () => ({ openModal: vi.fn() }) }));
// the crop step hands the picture back as it is
vi.mock("./CropProcess", () => ({
  cropProcess: () => (files: File[], resolve: (files: File[]) => void) =>
    resolve(files),
}));
vi.mock("@revolt/state", () => ({ ALLOWED_IMAGE_TYPES: ["image/png"] }));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
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
      <div
        role="dialog"
        data-actions-at-end={props.actionsAtEnd ? "" : undefined}
      >
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
    Button: (props: any) => (
      <button
        type="button"
        data-testid={props["data-testid"]}
        onClick={() => props.onPress?.()}
      >
        {props.children}
      </button>
    ),
    SettingsSection: (props: any) => (
      <section>
        {props.title}
        {props.children}
      </section>
    ),
    SettingsFormPanel: (props: any) => <div>{props.children}</div>,
    SettingsRow: (props: any) => (
      <div>
        {props.title}
        {props.control?.({ labelId: "l" })}
      </div>
    ),
    SettingsChoices: (props: any) => (
      <For each={props.options}>
        {(option: any) => (
          <button type="button" onClick={() => props.onChange(option.value)}>
            {option.title}
          </button>
        )}
      </For>
    ),
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

  it("puts the buttons at the end of the form, in the order Cancel, Save as draft, Publish", () => {
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
    const dialog = document.querySelector("[role=dialog]")!;
    expect(dialog.hasAttribute("data-actions-at-end")).toBe(true);
    const labels = [...dialog.querySelectorAll(":scope > button")].map(
      (button) => button.textContent,
    );
    expect(labels).toEqual(["Cancel", "Save draft", "Publish"]);
  });

  it("takes an own picture as the cover and uploads it with the event", async () => {
    fake.uploadFile = vi.fn(async () => "cover-id");
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
    title.value = "Film night";
    title.dispatchEvent(new InputEvent("input", { bubbles: true }));
    // the upload button opens the file picker
    const file = document.querySelector<HTMLInputElement>(
      "[data-testid=server-event-cover-file]",
    )!;
    const opened = vi.fn();
    file.addEventListener("click", (event) => {
      event.preventDefault();
      opened();
    });
    document
      .querySelector<HTMLButtonElement>(
        "[data-testid=server-event-cover-upload]",
      )!
      .click();
    expect(opened).toHaveBeenCalledTimes(1);

    const picture = new File([new Uint8Array([1, 2, 3])], "mine.png", {
      type: "image/png",
    });
    Object.defineProperty(file, "files", {
      value: [picture],
      configurable: true,
    });
    file.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    expect(
      document.querySelector("[data-testid=server-event-cover-own]"),
    ).not.toBeNull();

    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "Publish")!
      .click();
    await flush(50);
    expect(fake.uploadFile).toHaveBeenCalledWith("banners", picture, "");
    expect(create.mock.calls[0][1].cover).toBe("cover-id");
  });
});
