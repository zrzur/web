import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { type JSX, For, splitProps } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandManager } from "./CommandManager";
import type { CommandData, RegisteredCommand } from "./commandForm";

// The Developer Portal's command form: what a developer does with it must
// end in the list the server takes, and what the server would refuse must
// be refused here, in words, before anything is sent.

vi.mock("@revolt/ui", () => {
  const Button = (props: Record<string, unknown>) => {
    const [local, rest] = splitProps(props, [
      "children",
      "onPress",
      "size",
      "variant",
      "isDisabled",
    ]);
    return (
      <button
        {...(rest as object)}
        disabled={local.isDisabled as boolean}
        onClick={() => (local.onPress as (() => void) | undefined)?.()}
      >
        {local.children as never}
      </button>
    );
  };
  return {
    Button,
    Checkbox: (props: {
      checked?: boolean;
      disabled?: boolean;
      children?: JSX.Element;
      onChange?: (e: { currentTarget: { checked: boolean } }) => void;
    }) => (
      <label>
        <input
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          onChange={(e) =>
            props.onChange?.({
              currentTarget: { checked: e.currentTarget.checked },
            })
          }
        />
        {props.children}
      </label>
    ),
    // a design-system select: here a list of buttons, one per item
    FloatingSelect: (props: {
      label?: string;
      value?: string;
      children: JSX.Element;
      onChange?: (e: { currentTarget: { value: string } }) => void;
    }) => (
      <div
        role="listbox"
        aria-label={props.label}
        data-value={props.value}
        onClick={(e) => {
          const value = (e.target as HTMLElement).dataset.value;
          if (value) props.onChange?.({ currentTarget: { value } });
        }}
      >
        {props.children}
      </div>
    ),
    MenuItem: (props: { value: string; children?: JSX.Element }) => (
      <span role="option" data-value={props.value}>
        {props.children}
      </span>
    ),
    Segmented: (props: {
      value: string;
      options: { value: string; label: JSX.Element }[];
      onChange: (value: string) => void;
      "aria-label"?: string;
    }) => (
      <div role="radiogroup" aria-label={props["aria-label"]}>
        <For each={props.options}>
          {(option) => (
            <button
              role="radio"
              aria-checked={option.value === props.value}
              onClick={() => props.onChange(option.value)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
    ),
    TextField: (props: Record<string, unknown>) => {
      const [local, rest] = splitProps(props, [
        "label",
        "error",
        "helper",
        "rows",
        "autoFocus",
        "maxlength",
      ]);
      return (
        <span>
          <input
            {...(rest as object)}
            aria-label={local.label as string}
            aria-invalid={local.error ? "true" : undefined}
          />
          {local.error ? (
            <span data-error={local.label as string}>
              {local.error as string}
            </span>
          ) : null}
        </span>
      );
    },
  };
});
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: { type?: string } }) => (
    <span data-server-error>{props.error?.type ?? "error"}</span>
  ),
}));

const PERMISSIONS = [
  [2 ** 6, "Kick members"],
  [2 ** 23, "Manage messages"],
  [2 ** 37, "Mention everyone"],
] as const;

const registered = (
  command: Partial<RegisteredCommand> & { name: string },
): RegisteredCommand => ({
  _id: `id-${command.name}`,
  version: "v1",
  type: "ChatInput",
  description: "A command",
  ...command,
});

let dispose: (() => void) | undefined;
let save: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let reload: ReturnType<typeof vi.fn>;

function mount(commands: RegisteredCommand[] = []) {
  save = vi.fn(async (_list: CommandData[]) => undefined);
  remove = vi.fn(async (_id: string) => undefined);
  // the server's list right before a save: the same unless a test says so
  reload = vi.fn(async () => commands);
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <CommandManager
          commands={commands}
          permissionNames={PERMISSIONS}
          save={save as never}
          remove={remove as never}
          reload={reload as never}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
}

const field = (label: string, nth = 0) =>
  [...document.querySelectorAll<HTMLInputElement>("input")].filter(
    (input) => input.getAttribute("aria-label") === label,
  )[nth];

function type(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) =>
      b.textContent?.trim() === label || b.getAttribute("aria-label") === label,
  )!;

const check = (label: string) => {
  const box = [...document.querySelectorAll("label")]
    .find((l) => l.textContent?.trim() === label)!
    .querySelector("input")!;
  box.click();
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => dispose?.());

describe("command form", () => {
  it("builds a command with an option, choices, names and permissions", async () => {
    mount([registered({ name: "ping" })]);
    button("New command").click();

    type(field("Name"), "roll");
    type(field("Description"), "Roll a die");
    type(field("Arabic: name"), "نرد");
    type(field("German: description"), "Würfeln");

    button("Add option").click();
    // Text is the first type; pick a whole number
    (
      document.querySelector(
        '[role="option"][data-value="Integer"]',
      ) as HTMLElement
    ).click();
    type(field("Option name"), "sides");
    type(field("Option description"), "How many sides");
    check("Required");
    type(field("Smallest value"), "2");
    type(field("Largest value"), "100");

    check("Manage messages");
    check("Mention everyone");

    // the preview shows the command as people will see it
    expect(
      document.querySelector('[data-testid="preview-name"]')?.textContent,
    ).toBe("/roll");

    button("Save command").click();
    await tick();

    expect(save).toHaveBeenCalledTimes(1);
    const list = save.mock.calls[0][0] as CommandData[];
    expect(list.map((c) => c.name)).toEqual(["ping", "roll"]);
    expect(list[1]).toEqual({
      type: "ChatInput",
      name: "roll",
      name_localizations: { ar: "نرد" },
      description: "Roll a die",
      description_localizations: { de: "Würfeln" },
      options: [
        {
          type: "Integer",
          name: "sides",
          description: "How many sides",
          required: true,
          min_value: 2,
          max_value: 100,
        },
      ],
      default_member_permissions: 2 ** 23 + 2 ** 37,
    });
    // back on the list, with a confirmation
    expect(document.body.textContent).toContain("Saved.");
  });

  it("refuses what the server refuses, in words, and sends nothing", async () => {
    mount();
    button("New command").click();
    type(field("Name"), "Roll Dice");
    button("Save command").click();
    await tick();

    expect(save).not.toHaveBeenCalled();
    expect(field("Name").getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).toContain(
      "Use lowercase letters, digits, - and _ only, without spaces.",
    );
    expect(document.body.textContent).toContain("Use 1 to 100 characters.");

    // required after optional, the server's ordering rule
    type(field("Name"), "roll");
    type(field("Description"), "Roll");
    button("Add option").click();
    button("Add option").click();
    type(field("Option name", 0), "a");
    type(field("Option description", 0), "a");
    type(field("Option name", 1), "b");
    type(field("Option description", 1), "b");
    const required = [...document.querySelectorAll("label")].filter(
      (l) => l.textContent?.trim() === "Required",
    )[1];
    required.querySelector("input")!.click();
    button("Save command").click();
    await tick();
    expect(save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Required options come before optional ones.",
    );

    // moving it up fixes it
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="Move up"]',
      ),
    ][1].click();
    button("Save command").click();
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    const [command] = save.mock.calls[0][0] as CommandData[];
    expect(command.options?.map((o) => o.name)).toEqual(["b", "a"]);
  });

  it("edits a menu command: no description, capitals allowed", async () => {
    mount();
    button("New command").click();
    button("Message menu").click();
    expect(field("Description")).toBeUndefined();
    type(field("Name"), "Translate Message");
    expect(
      document.querySelector('[data-testid="preview-name"]')?.textContent,
    ).toContain("Translate Message");
    button("Save command").click();
    await tick();
    expect(save.mock.calls[0][0]).toEqual([
      { type: "Message", name: "Translate Message" },
    ]);
  });

  it("keeps an existing command's id place and fields when edited", async () => {
    mount([
      registered({
        name: "ping",
        default_member_permissions: 64,
        name_localizations: { pt: "pingar" },
      }),
      registered({ name: "pong" }),
    ]);
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .filter((b) => b.textContent?.trim() === "Edit")[0]
      .click();
    expect(field("Name").value).toBe("ping");
    type(field("Description"), "Check the bot");
    button("Save command").click();
    await tick();
    const list = save.mock.calls[0][0] as CommandData[];
    expect(list.map((c) => c.name)).toEqual(["ping", "pong"]);
    expect(list[0]).toMatchObject({
      description: "Check the bot",
      default_member_permissions: 64,
      // a language the form does not show is kept
      name_localizations: { pt: "pingar" },
    });
  });

  it("shows the server's refusal in the same form", async () => {
    mount();
    save.mockRejectedValueOnce({ type: "TooManyCommands" });
    button("New command").click();
    type(field("Name"), "roll");
    type(field("Description"), "Roll");
    button("Save command").click();
    await tick();
    await tick();
    expect(document.querySelector("[data-server-error]")?.textContent).toBe(
      "TooManyCommands",
    );
    // still editing: nothing typed is lost
    expect(field("Name").value).toBe("roll");
  });

  it("saves with Ctrl+Enter and goes back with Escape", async () => {
    mount();
    button("New command").click();
    type(field("Name"), "hello");
    type(field("Description"), "Say hello");
    field("Name").dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      }),
    );
    await tick();
    expect(save).toHaveBeenCalledTimes(1);

    button("New command").click();
    field("Name").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(field("Name")).toBeUndefined();
  });

  it("deletes after a second click", async () => {
    mount([registered({ name: "ping" })]);
    button("Delete").click();
    expect(remove).not.toHaveBeenCalled();
    button("Confirm delete").click();
    await tick();
    expect(remove).toHaveBeenCalledWith("id-ping");
  });
});

describe("JSON import and export", () => {
  it("exports what PUT takes, and imports after a check and a confirmation", async () => {
    mount([registered({ name: "ping", description: "Check" })]);
    expect(JSON.parse(field("Export").value)).toEqual([
      { type: "ChatInput", name: "ping", description: "Check" },
    ]);

    type(field("Import"), '[{ "name": "Bad Name", "description": "x" }]');
    button("Check and import").click();
    await tick();
    expect(save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Bad Name:");

    type(field("Import"), "not json");
    button("Check and import").click();
    await tick();
    expect(document.body.textContent).toContain("This is not valid JSON.");

    type(field("Import"), '[{ "name": "hello", "description": "Say hello" }]');
    button("Check and import").click();
    await tick();
    expect(save).not.toHaveBeenCalled();
    button("Replace all commands").click();
    await tick();
    expect(save).toHaveBeenCalledWith([
      { name: "hello", description: "Say hello" },
    ]);
  });
});

describe("saving against a list that changed", () => {
  it("stops when the list changed since the editor opened, then saves", async () => {
    const ping = registered({ name: "ping" });
    mount([ping]);
    reload.mockResolvedValueOnce([{ ...ping, version: "v2" }]);
    button("New command").click();
    type(field("Name"), "roll");
    type(field("Description"), "Roll");
    button("Save command").click();
    await tick();
    await tick();
    expect(save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "The list changed since you opened it.",
    );
    // checked again with what is there now: saves
    reload.mockResolvedValueOnce([{ ...ping, version: "v2" }]);
    button("Save command").click();
    await tick();
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("sends commands nobody edited exactly as the server has them", async () => {
    const other = registered({
      name: "other",
      options: [
        { type: "String", name: "o", description: "d", required: false },
      ],
    });
    mount([other]);
    button("New command").click();
    type(field("Name"), "roll");
    type(field("Description"), "Roll");
    button("Save command").click();
    await tick();
    await tick();
    const [sent] = save.mock.calls[0][0] as CommandData[];
    expect(sent).toEqual({
      type: "ChatInput",
      name: "other",
      description: "A command",
      options: [
        { type: "String", name: "o", description: "d", required: false },
      ],
    });
  });

  it("checks the list before an import replaces it", async () => {
    const ping = registered({ name: "ping" });
    mount([ping]);
    reload.mockResolvedValueOnce([]);
    type(field("Import"), '[{ "name": "hello", "description": "Say hello" }]');
    button("Check and import").click();
    await tick();
    button("Replace all commands").click();
    await tick();
    await tick();
    expect(save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "The list changed since you opened it.",
    );
  });

  it("says that a bot's own list replaces what is saved here", () => {
    mount();
    expect(document.body.textContent).toContain(
      "If your bot sends its list when it starts, that list replaces what you save here.",
    );
  });
});
