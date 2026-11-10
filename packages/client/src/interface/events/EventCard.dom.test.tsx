/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerEventCollection } from "@zrzur/sdk/solid";

const SV = "01ARZ3NDEKTSV4RRFFQ69G5FSV";
const E1 = "01ARZ3NDEKTSV4RRFFQ69G5FE1";

const fake: any = {
  user: { id: "me" },
  channels: { get: () => undefined },
  users: { get: () => undefined, getOrCreate: () => undefined },
  configuration: { features: { autumn: { enabled: false } } },
  api: {},
};

vi.mock("@revolt/client", () => ({ useClient: () => () => fake }));
vi.mock("@revolt/i18n", () => ({
  timeLocale: () => ["en", { formats: { LT: "HH:mm" } }],
}));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: unknown }) => (
    <span>{String(props.error)}</span>
  ),
}));
vi.mock("@revolt/markdown", () => ({
  Markdown: (props: { content: string }) => <p>{props.content}</p>,
}));
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal: vi.fn() }) }));
vi.mock("@revolt/routing", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@revolt/rtc", () => ({
  useVoice: () => ({ channel: () => undefined }),
}));
vi.mock("@revolt/instance", () => ({
  useInstance: () => ({ href: (path: string) => `https://app.test${path}` }),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/ui", () => ({
  Avatar: () => <span />,
  Button: (props: any) => (
    <button
      type="button"
      data-testid={props["data-testid"]}
      aria-pressed={props["aria-pressed"]}
      aria-disabled={props["aria-disabled"]}
      aria-expanded={props["aria-expanded"]}
      disabled={props.isDisabled}
      onClick={() => props.onPress?.()}
    >
      {props.children}
    </button>
  ),
}));

const { EventCard } = await import("./EventCard");

const event = (extra: Record<string, unknown> = {}) => ({
  _id: E1,
  server: SV,
  creator: "someone",
  title: "Game night",
  starts_at: "2027-12-01T18:00:00Z",
  place: { type: "External", location: "Park" },
  status: "Scheduled",
  interested_count: 0,
  ...extra,
});

const server: any = { id: SV, havePermission: () => true };
let dispose: (() => void) | undefined;
let resolveMark: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  fake.serverEvents = new ServerEventCollection(fake);
  fake.api = {
    get: async () => ({ events: [event()], interested: [] }),
    put: () =>
      new Promise((resolve) => {
        resolveMark = () =>
          resolve({ event: event({ interested_count: 1 }), interested: true });
      }),
    post: async () => event({ status: "Cancelled" }),
  };
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

async function mount(extra: Record<string, unknown> = {}) {
  fake.api.get = async () => ({ events: [event(extra)], interested: [] });
  await fake.serverEvents.fetchForServer(SV);
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <For each={fake.serverEvents.forServer(SV)}>
          {(entry: any) => (
            <EventCard
              event={entry}
              server={server}
              now={Date.parse("2027-11-01T00:00:00Z")}
            />
          )}
        </For>
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("EventCard", () => {
  it("keeps the focus on I'm interested while it is marked", async () => {
    await mount();
    const toggle = document.querySelector<HTMLButtonElement>(
      "[data-testid=event-interested]",
    )!;
    toggle.focus();
    toggle.click();
    // a second press while the first is on its way does nothing
    toggle.click();
    resolveMark!();
    await flush();
    const after = document.querySelector<HTMLButtonElement>(
      "[data-testid=event-interested]",
    )!;
    expect(after).toBe(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.disabled).toBe(false);
  });

  it("asks to cancel this time only, and offers the whole series apart", async () => {
    await mount({ repeat: "Weekly" });
    // the whole series is its own action, beside this time
    expect(
      document.querySelector("[data-testid=event-cancel-series]"),
    ).not.toBeNull();
    document
      .querySelector<HTMLButtonElement>("[data-testid=event-cancel]")!
      .click();
    await flush();
    const text = document.body.textContent ?? "";
    expect(text).toContain("The next one stays scheduled");
  });
});
