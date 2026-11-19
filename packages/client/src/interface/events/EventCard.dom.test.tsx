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
  users: {
    get: () => undefined,
    getOrCreate: () => undefined,
    fetch: async () => undefined,
  },
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
  TextField: () => <input />,
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
const { EventDetail } = await import("./EventDetail");

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
let deleted: { id: string; series: boolean }[] = [];
let numbers: unknown = {};

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  fake.serverEvents = new ServerEventCollection(fake);
  deleted = [];
  numbers = {};
  fake.api = {
    get: async () => ({ events: [event()], interested: [] }),
    put: () =>
      new Promise((resolve) => {
        resolveMark = () =>
          resolve({
            event: event({ interested_count: 1 }),
            interested: true,
            rsvp: { answer: "Going", waiting: false },
          });
      }),
    post: async () => event({ status: "Cancelled" }),
  };
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

async function mount(
  extra: Record<string, unknown> = {},
  answers: unknown[] = [],
  Shown: typeof EventDetail = EventDetail,
) {
  fake.api.get = async (path: string) =>
    path.endsWith("/attendees")
      ? { attendees: [] }
      : path.endsWith("/stats")
        ? numbers
        : { events: [event(extra)], interested: [], answers };
  await fake.serverEvents.fetchForServer(SV);
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <For each={[fake.serverEvents.get(E1)].filter(Boolean)}>
          {(entry: any) => (
            <Shown
              event={entry}
              server={server}
              now={Date.parse("2027-11-01T00:00:00Z")}
              onDeleted={(info) => deleted.push(info)}
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
  it("shows the seats and your own answer on the card", async () => {
    await mount(
      {
        capacity: 20,
        counts: { going: 18, maybe: 2, not_going: 0, waiting: 0 },
      },
      [{ event: E1, answer: "Going", waiting: false }],
      EventCard as typeof EventDetail,
    );
    expect(
      document.querySelector("[data-testid=event-count-line]")!.textContent,
    ).toContain("18 of 20 seats");
    expect(
      document.querySelector("[data-testid=event-own-answer]")!.textContent,
    ).toContain("You have a seat");
    // a ticket: the day on its stub, marked as yours
    expect(
      document.querySelector("[data-testid=ticket-stub][data-mine]"),
    ).not.toBeNull();
    // management lives on the event's own page
    expect(document.querySelector("[data-testid=event-delete]")).toBeNull();
  });

  it("a card without your answer offers to answer", async () => {
    await mount({}, [], EventCard as typeof EventDetail);
    expect(
      document.querySelector("[data-testid=event-answer-open]"),
    ).not.toBeNull();
    expect(document.querySelector("[data-testid=event-own-answer]")).toBeNull();
  });
});

describe("EventDetail", () => {
  it("offers the waiting list when every seat is taken", async () => {
    await mount({
      capacity: 2,
      waitlist: true,
      counts: { going: 2, maybe: 0, not_going: 0, waiting: 3 },
    });
    const going = document.querySelector<HTMLButtonElement>(
      "[data-testid=event-answer-going]",
    )!;
    expect(going.textContent).toContain("Join the waiting list");
    expect(going.disabled).toBe(false);
    expect(document.body.textContent).toContain("All seats are taken");
    expect(document.body.textContent).toContain(
      "3 people are waiting before you",
    );
  });

  it("without a waiting list a full event cannot be joined", async () => {
    await mount({
      capacity: 2,
      waitlist: false,
      counts: { going: 2, maybe: 0, not_going: 0, waiting: 0 },
    });
    expect(
      document.querySelector<HTMLButtonElement>(
        "[data-testid=event-answer-going]",
      )!.disabled,
    ).toBe(true);
    expect(document.body.textContent).toContain(
      "This event has no waiting list",
    );
  });

  it("says where you stand on the waiting list", async () => {
    await mount(
      {
        capacity: 2,
        counts: { going: 2, maybe: 0, not_going: 0, waiting: 3 },
      },
      [{ event: E1, answer: "Going", waiting: true }],
    );
    fake.serverEvents.ownAnswer(E1, {
      answer: "Going",
      waiting: true,
      position: 3,
    });
    await flush();
    expect(document.body.textContent).toContain(
      "You are number 3 on the waiting list",
    );
  });

  it("hides the names when only organisers may see them", async () => {
    server.havePermission = () => false;
    try {
      await mount({
        attendee_list: "Organisers",
        counts: { going: 4, maybe: 1, not_going: 0, waiting: 0 },
      });
      expect(
        document.querySelector("[data-testid=event-people-hidden]"),
      ).not.toBeNull();
      expect(document.querySelector("[data-testid=event-delete]")).toBeNull();
    } finally {
      server.havePermission = () => true;
    }
  });

  it("keeps the numbers and says the names are gone after the retention time", async () => {
    await mount({
      status: "Completed",
      people_removed_at: "2028-12-01T18:00:00Z",
      counts: { going: 18, maybe: 0, not_going: 0, waiting: 0 },
    });
    expect(
      document.querySelector("[data-testid=event-people-removed]"),
    ).not.toBeNull();
  });

  it("keeps the focus on Going while the answer is on its way", async () => {
    await mount();
    const toggle = document.querySelector<HTMLButtonElement>(
      "[data-testid=event-answer-going]",
    )!;
    toggle.focus();
    toggle.click();
    // a second press while the first is on its way does nothing
    toggle.click();
    resolveMark!();
    await flush();
    const after = document.querySelector<HTMLButtonElement>(
      "[data-testid=event-answer-going]",
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

  it("deletes the whole series apart, with its own words, and the card goes", async () => {
    const calls: string[] = [];
    fake.api.delete = async (path: string, params: unknown) => {
      calls.push(`${path} ${JSON.stringify(params)}`);
    };
    await mount({ repeat: "Weekly" });
    expect(
      document.querySelector("[data-testid=event-delete]")!.textContent,
    ).toContain("Delete this time");
    document
      .querySelector<HTMLButtonElement>("[data-testid=event-delete-series]")!
      .click();
    await flush();
    expect(document.body.textContent).toContain(
      "Delete this one and every one after it for good? Nothing more of this series is scheduled.",
    );
    const confirm = document.querySelector<HTMLButtonElement>(
      "[data-testid=event-confirm]",
    )!;
    expect(confirm.textContent).toContain("Delete the whole series");
    confirm.click();
    await flush();
    expect(calls).toEqual([`/servers/${SV}/events/${E1} {"series":true}`]);
    expect(document.querySelector("[data-testid=event-detail]")).toBeNull();
  });

  it("deleting this time only keeps the series and says so to the page", async () => {
    const calls: string[] = [];
    fake.api.delete = async (path: string, params: unknown) => {
      calls.push(`${path} ${JSON.stringify(params)}`);
    };
    await mount({ repeat: "Weekly" });
    document
      .querySelector<HTMLButtonElement>("[data-testid=event-delete]")!
      .click();
    await flush();
    expect(document.body.textContent).toContain("The next one stays scheduled");
    const confirm = document.querySelector<HTMLButtonElement>(
      "[data-testid=event-confirm]",
    )!;
    expect(confirm.textContent).toContain("Delete this time");
    confirm.click();
    await flush();
    expect(calls).toEqual([`/servers/${SV}/events/${E1} {}`]);
    expect(deleted).toEqual([{ id: E1, series: false }]);
  });

  it("a one-off event keeps a single Delete", async () => {
    await mount();
    expect(
      document.querySelector("[data-testid=event-delete-series]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-testid=event-delete]")!.textContent,
    ).toContain("Delete");
    expect(
      document.querySelector("[data-testid=event-delete]")!.textContent,
    ).not.toContain("this time");
  });

  it("shows organisers the numbers: answers, seats taken and the days", async () => {
    numbers = {
      counts: { going: 3, maybe: 1, not_going: 1, waiting: 2 },
      capacity: 4,
      registrations: [
        { day: "2027-11-20", going: 2, maybe: 1, not_going: 0 },
        { day: "2027-11-21", going: 3, maybe: 0, not_going: 1 },
      ],
      present_at_start: 5,
    };
    await mount({
      capacity: 4,
      counts: { going: 3, maybe: 1, not_going: 1, waiting: 2 },
    });
    await flush();
    const stats = document.querySelector("[data-testid=event-stats]")!;
    expect(
      stats.querySelector("[data-testid=event-stats-answered]")!.textContent,
    ).toBe("7");
    expect(
      stats.querySelector("[data-testid=event-stats-fill]")!.textContent,
    ).toBe("75%");
    expect(
      stats.querySelectorAll("[data-testid=event-stats-days] [role=listitem]")
        .length,
    ).toBe(2);
    expect(stats.textContent).toContain("Only the number is kept.");
  });

  it("keeps the numbers from people who do not run the event", async () => {
    server.havePermission = () => false;
    try {
      await mount();
      await flush();
      expect(document.querySelector("[data-testid=event-stats]")).toBeNull();
    } finally {
      server.havePermission = () => true;
    }
  });
});
