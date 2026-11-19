/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerEventCollection } from "@zrzur/sdk/solid";

const SV = "01ARZ3NDEKTSV4RRFFQ69G5FSV";

const fake: any = {
  user: { id: "me" },
  users: { getOrCreate: () => undefined },
  api: {},
};
const navigate = vi.fn();

vi.mock("@revolt/client", () => ({ useClient: () => () => fake }));
vi.mock("@revolt/i18n", () => ({
  timeLocale: () => ["en", { formats: { LT: "HH:mm" } }],
}));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: unknown }) => (
    <span>{String(props.error)}</span>
  ),
}));
vi.mock("@revolt/routing", () => ({ useNavigate: () => navigate }));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/ui", () => ({
  Button: (props: any) => (
    <button
      type="button"
      data-testid={props["data-testid"]}
      onClick={() => props.onPress?.()}
    >
      {props.children}
    </button>
  ),
  Segmented: (props: any) => (
    <div role="radiogroup">
      <For each={props.options}>
        {(option: any) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.value === option.value}
            data-testid={`calendar-view-${option.value}`}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  ),
}));
// the card of an event is not what is tested here
vi.mock("./EventCard", () => ({
  eventPath: (server: string, id: string) => `/server/${server}/events/${id}`,
}));

const { EventCalendar } = await import("./EventCalendar");
const { dayKey } = await import("./calendarDays");

/** Today at an hour of the local clock, and other days of this month */
const on = (day: number, hour: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, hour).toISOString();
};
const today = new Date().getDate();
// another day of this month that is never today
const other = today === 15 ? 16 : 15;

const event = (id: string, starts_at: string, extra: object = {}) => ({
  _id: id,
  server: SV,
  creator: "someone",
  title: `Event ${id}`,
  starts_at,
  place: { type: "External", location: "Park" },
  status: "Scheduled",
  interested_count: 0,
  ...extra,
});

let dispose: (() => void) | undefined;
let asked: { from: string; to: string }[] = [];
let listed: any[] = [];

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  fake.serverEvents = new ServerEventCollection(fake);
  navigate.mockClear();
  asked = [];
  listed = [
    event("A", on(today, 18)),
    event("B", on(today, 9)),
    event("C", on(other, 20), { status: "Cancelled" }),
    event("D", on(other, 10)),
    event("E", on(other, 11)),
    event("F", on(other, 12)),
    event("G", on(other, 13), { status: "Draft" }),
  ];
  fake.api.get = async (_path: string, query: { from: string; to: string }) => {
    asked.push(query);
    return { events: listed, interested: [], answers: [] };
  };
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

async function mount(filter?: (event: any) => boolean) {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <EventCalendar
          load={(from, to) => fake.serverEvents.fetchRange(SV, from, to)}
          filter={filter}
          day={(events) => (
            <ul data-testid="day-events">
              <For each={events}>{(event) => <li>{event.title}</li>}</For>
            </ul>
          )}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  await vi.waitFor(() =>
    expect(document.querySelectorAll("[data-testid=calendar-event]").length).toBeGreaterThan(0),
  );
}

const cell = (day: number) => {
  const now = new Date();
  const key = dayKey(new Date(now.getFullYear(), now.getMonth(), day));
  return document.querySelector(`[data-day="${key}"]`) as HTMLElement;
};
const titles = (root: ParentNode) =>
  [...root.querySelectorAll("[data-testid=calendar-event] span")].map(
    (node) => node.textContent,
  );

describe("the calendar of events", () => {
  it("shows a month of whole weeks and asks the server for exactly those days", async () => {
    await mount();
    const days = document.querySelectorAll("[role=gridcell]");
    expect(days.length % 7).toBe(0);
    expect(days.length).toBeGreaterThanOrEqual(28);
    expect(asked.length).toBe(1);
    const first = (days[0] as HTMLElement).dataset.day!;
    expect(dayKey(new Date(asked[0].from))).toBe(first);
  });

  it("puts each event on its day, soonest first, and never a draft", async () => {
    await mount();
    expect(titles(cell(today))).toEqual(["Event B", "Event A"]);
    // three fit in a cell; the fourth is behind "more"
    expect(titles(cell(other))).toEqual(["Event D", "Event E", "Event F"]);
    expect(cell(other).textContent).toContain("1 more");
    expect(document.body.textContent).not.toContain("Event G");
    // a called-off event is still there, marked
    (cell(other).querySelector("button:not([data-testid])") as HTMLElement).click();
    expect(
      document.querySelector("[data-testid=day-events]")!.textContent,
    ).toContain("Event C");
  });

  it("starts on today and shows the tickets of the chosen day", async () => {
    await mount();
    const list = () => document.querySelector("[data-testid=calendar-day-list]")!;
    expect(cell(today).getAttribute("aria-selected")).toBe("true");
    expect(list().textContent).toContain("Event B");
    expect(list().textContent).not.toContain("Event D");

    (cell(other).querySelector("[data-testid=calendar-day]") as HTMLElement).click();
    expect(cell(other).getAttribute("aria-selected")).toBe("true");
    expect(list().textContent).toContain("Event D");
    expect(list().textContent).not.toContain("Event B");
  });

  it("opens an event from its chip", async () => {
    await mount();
    (cell(today).querySelector("[data-testid=calendar-event]") as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(`/server/${SV}/events/B`);
  });

  it("moves by a month, comes back with Today, and switches to a week", async () => {
    await mount();
    const title = () =>
      document.querySelector("[data-testid=calendar-title]")!.textContent;
    const thisMonth = title();
    (document.querySelector("[data-testid=calendar-next]") as HTMLElement).click();
    await vi.waitFor(() => expect(asked.length).toBe(2));
    expect(title()).not.toBe(thisMonth);
    (document.querySelector("[data-testid=calendar-today]") as HTMLElement).click();
    await vi.waitFor(() => expect(title()).toBe(thisMonth));
    expect(cell(today).getAttribute("aria-selected")).toBe("true");

    (document.querySelector("[data-testid=calendar-view-week]") as HTMLElement).click();
    await vi.waitFor(() =>
      expect(document.querySelectorAll("[role=gridcell]").length).toBe(7),
    );
    expect(
      document
        .querySelector("[data-testid=event-calendar]")!
        .getAttribute("data-view"),
    ).toBe("week");
    // a week lists every event of a day
    expect(titles(cell(today))).toEqual(["Event B", "Event A"]);
  });

  it("leaves out what the search does not match", async () => {
    await mount((event) => event.title !== "Event B");
    expect(titles(cell(today))).toEqual(["Event A"]);
  });
});
