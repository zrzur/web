import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For, splitProps } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InsightsPage from "./InsightsPage";

// The insights page: one request per range (switching back is instant),
// the numbers and bars of the answer, "fewer than 5" for small channels,
// and the error with Try again in the page itself.

vi.mock("@revolt/ui", () => ({
  Button: (props: Record<string, unknown>) => {
    const [local, rest] = splitProps(props, [
      "children",
      "onPress",
      "size",
      "variant",
    ]);
    return (
      <button
        {...(rest as object)}
        onClick={() => (local.onPress as () => void)?.()}
      >
        {local.children as never}
      </button>
    );
  },
  Segmented: (props: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  }) => (
    <div role="radiogroup">
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
}));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({
    channels: {
      get: (id: string) => (id === "C1" ? { name: "general" } : undefined),
    },
  }),
}));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: { type?: string } }) => (
    <span data-error>{props.error?.type ?? "error"}</span>
  ),
}));

const rows = (days: number) =>
  Array.from({ length: days }, (_, i) => ({
    day: `2026-11-${String(i + 1).padStart(2, "0")}`,
    joins: i === days - 1 ? 3 : 0,
    leaves: i === days - 1 ? 1 : 0,
    members: 40 + i,
    messages: i * 2,
    // 1 to 4 people come as null
    active_members: i === days - 1 ? null : 6,
    voice_minutes: 30,
  }));

const page = (days: number) => ({
  days,
  time_zone: "Europe/Vienna",
  rows: rows(days),
  totals: {
    joins: 3,
    leaves: 1,
    messages: days * (days - 1),
    voice_minutes: 30 * days,
    active_members: null,
  },
  counted_since: "2026-11-01",
  join_sources: { invite: 2, discover: 1, vanity: 0, other: 0 },
  top_channels: [
    { channel: "C1", messages: 12_345 },
    { channel: "C2", messages: null },
  ],
});

let dispose: (() => void) | undefined;
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => dispose?.());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(server: object) {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <InsightsPage server={server as never} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
}

const text = (id: string) =>
  document.querySelector(`[data-testid=${id}]`)?.textContent;

describe("server insights page", () => {
  it("shows the totals, a bar per day and hides small channel counts", async () => {
    const fetchInsights = vi.fn(
      async ({ days }: { days: number; utcOffset?: number }) => page(days),
    );
    mount({ fetchInsights });
    await flush();
    await flush();

    expect(fetchInsights).toHaveBeenCalledTimes(1);
    expect(fetchInsights.mock.calls[0][0].days).toBe(30);
    expect(typeof fetchInsights.mock.calls[0][0].utcOffset).toBe("number");
    expect(text("insights-members")).toBe("69");
    expect(text("insights-joins")).toBe("3");
    expect(text("insights-messages")).toBe(
      new Intl.NumberFormat("en").format(870),
    );
    expect(
      document.querySelectorAll("[data-stat=joins] [role=img] > *").length,
    ).toBe(30);
    const channels = text("insights-channels") ?? "";
    expect(channels).toContain("#general");
    expect(channels).toContain("12,345");
    expect(channels).toContain("fewer than 5");
    expect(channels).toContain("Unknown channel");
    expect(text("insights-zone")).toContain("Europe/Vienna");
    // a hidden small number reads "fewer than 5", in the card and the bar
    expect(text("insights-active")).toBe("fewer than 5");
    const lastBar = [
      ...document.querySelectorAll("[data-stat=active] [role=img] > *"),
    ].at(-1) as HTMLElement;
    expect(lastBar.title).toContain("fewer than 5");
    expect(text("insights-since")).toContain("2026");
    // nothing names a person
    expect(document.body.textContent).not.toMatch(/\b[0-9A-Z]{26}\b/);
  });

  it("asks once per range and switches back without asking again", async () => {
    const fetchInsights = vi.fn(
      async ({ days }: { days: number; utcOffset?: number }) => page(days),
    );
    mount({ fetchInsights });
    await flush();
    const radios = () => [
      ...document.querySelectorAll<HTMLButtonElement>("[role=radio]"),
    ];
    radios()[0].click(); // 7 days
    await flush();
    await flush();
    expect(
      document.querySelectorAll("[data-stat=joins] [role=img] > *").length,
    ).toBe(7);
    radios()[1].click(); // back to 30
    await flush();
    await flush();
    expect(
      document.querySelectorAll("[data-stat=joins] [role=img] > *").length,
    ).toBe(30);
    expect(fetchInsights.mock.calls.map((call) => call[0].days)).toEqual([
      30, 7,
    ]);
  });

  it("shows the error in the page and tries again", async () => {
    let fail = true;
    const fetchInsights = vi.fn(
      async ({ days }: { days: number; utcOffset?: number }) => {
        if (fail) throw { type: "MissingPermission" };
        return page(days);
      },
    );
    mount({ fetchInsights });
    await flush();
    await flush();
    expect(text("insights-error")).toContain("MissingPermission");
    fail = false;
    document
      .querySelector<HTMLButtonElement>("[data-testid=insights-error] button")!
      .click();
    await flush();
    await flush();
    expect(text("insights-joins")).toBe("3");
  });

  it("says when nothing was counted yet", async () => {
    const empty = {
      ...page(30),
      rows: rows(30).map((row) => ({
        ...row,
        joins: 0,
        leaves: 0,
        messages: 0,
        active_members: 0,
        voice_minutes: 0,
      })),
      top_channels: [],
    };
    mount({ fetchInsights: vi.fn(async () => empty) });
    await flush();
    await flush();
    expect(text("insights-empty")).toContain("Nothing counted yet");
    expect(text("insights-channels")).toContain(
      "No messages in this range yet.",
    );
  });
});
