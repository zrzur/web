import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Voting must keep the row (and the keyboard focus) where it is: every vote
// brings a brand-new poll object, and rows keyed by those objects were
// rebuilt, so the second Space press went nowhere.

vi.mock("@zrzur/sdk/solid", () => ({
  pollClosed: (poll: { ended?: boolean }) => !!poll.ended,
}));
vi.mock("@revolt/app/interface/channels/threadAccess", () => ({
  threadIsReadOnly: () => false,
}));
vi.mock("@revolt/i18n", () => ({
  useTime: () => () => ({ fromNow: () => "in 1 hour" }),
}));
vi.mock("@revolt/i18n/errors", () => ({ TranslatedError: () => <span /> }));
vi.mock("@revolt/markdown/emoji", () => ({ Emoji: () => <span /> }));
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal: vi.fn() }) }));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));

import { PollCard } from "./PollCard";

type Poll = {
  question: string;
  answers: { id: number; text: string; count: number }[];
  expires_at: string;
  me: number[];
  ended?: boolean;
  allow_multiselect?: boolean;
};

let dispose: (() => void) | undefined;

function setup(multi: boolean) {
  const fresh = (me: number[]): Poll => ({
    question: "Lunch?",
    answers: [1, 2, 3].map((id) => ({
      id,
      text: `A${id}`,
      count: me.includes(id) ? 1 : 0,
    })),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    me,
    allow_multiselect: multi,
  });
  const [poll, setPoll] = createSignal(fresh([]));
  const message = {
    id: "M",
    get poll() {
      return poll();
    },
    channel: { havePermission: () => true },
    // like the SDK: the answer replaces the whole poll object
    votePoll: async (id: number) =>
      setPoll(fresh(multi ? [...poll().me, id] : [id])),
    unvotePoll: async (id: number) =>
      setPoll(fresh(poll().me.filter((x) => x !== id))),
  };
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <PollCard message={message as never} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return () => [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-testid="poll-answer"]',
    ),
  ];
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => i18n.loadAndActivate({ locale: "en", messages: {} }));
afterEach(() => dispose?.());

describe("PollCard", () => {
  it("keeps the row and its focus across two presses", async () => {
    const rows = setup(false);
    const second = rows()[1];
    second.focus();

    second.click(); // Space on a focused button
    await settle();
    expect(rows()[1]).toBe(second);
    expect(second.isConnected).toBe(true);
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-checked")).toBe("true");

    second.click();
    await settle();
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-checked")).toBe("false");
  });

  it("has one tab stop; arrow keys move inside the group", async () => {
    const rows = setup(true);
    expect(rows().map((row) => row.tabIndex)).toEqual([0, -1, -1]);
    rows()[0].focus();
    rows()[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(rows()[1]);
    expect(rows().map((row) => row.tabIndex)).toEqual([-1, 0, -1]);
  });
});
