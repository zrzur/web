import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { ReactiveMap } from "@solid-primitives/map";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui/components/design", () => ({
  Button: (props: {
    children?: unknown;
    onPress?: () => void;
    isDisabled?: boolean;
    type?: "submit";
    [data: `data-${string}`]: unknown;
  }) => (
    <button
      type={props.type ?? "button"}
      data-stage-action={props["data-stage-action"] as string}
      disabled={props.isDisabled}
      onClick={() => props.onPress?.()}
    >
      {props.children as string}
    </button>
  ),
  Avatar: () => <span />,
  TextField: (props: {
    value?: string;
    onInput?: (event: { currentTarget: { value: string } }) => void;
  }) => (
    <input
      data-topic-field
      value={props.value ?? ""}
      onInput={(event) =>
        props.onInput?.({ currentTarget: event.currentTarget })
      }
    />
  ),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <i /> }));
vi.mock("@revolt/markdown/users", () => ({
  useUsers: (ids: () => string[]) => () =>
    ids().map((id) => ({ username: `name-${id}` })),
}));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ user: { id: "me" } }),
}));
vi.mock("@revolt/i18n", () => ({
  useError: () => (err: unknown) => `plain: ${String(err)}`,
}));

import StagePanel from "./StagePanel";

type State = { topic?: string; speakers: string[]; hands: string[] };

function fakeChannel(moderator: boolean) {
  const [stage, setStage] = createSignal<State>({ speakers: [], hands: [] });
  const participants = new ReactiveMap<string, unknown>([
    ["me", {}],
    ["host", {}],
    ["asker", {}],
  ]);
  const channel = {
    stage,
    voiceParticipants: participants,
    havePermission: (name: string) => moderator && name === "MuteMembers",
    raiseHand: vi.fn(async () =>
      setStage((s) => ({ ...s, hands: [...s.hands, "me"] })),
    ),
    lowerHand: vi.fn(async (id = "me") =>
      setStage((s) => ({ ...s, hands: s.hands.filter((h) => h !== id) })),
    ),
    inviteToSpeak: vi.fn(async (id: string) =>
      setStage((s) => ({
        ...s,
        speakers: [...s.speakers, id === "@me" ? "me" : id],
        hands: s.hands.filter((h) => h !== id),
      })),
    ),
    moveToAudience: vi.fn(async (id = "me") =>
      setStage((s) => ({ ...s, speakers: s.speakers.filter((x) => x !== id) })),
    ),
    editStage: vi.fn(async (topic?: string) =>
      setStage((s) => ({ ...s, topic })),
    ),
    endStage: vi.fn(async () => setStage({ speakers: [], hands: [] })),
  };
  return { channel, setStage };
}

let dispose: (() => void) | undefined;
function mount(channel: unknown) {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <StagePanel channel={channel as never} />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const action = (name: string) =>
  document.querySelector<HTMLButtonElement>(`[data-stage-action="${name}"]`);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
});
afterEach(() => dispose?.());

describe("stage panel, audience", () => {
  it("raises and lowers a hand, and has no moderator buttons", async () => {
    const { channel } = fakeChannel(false);
    mount(channel);
    expect(action("speak")).toBeNull();
    expect(action("end")).toBeNull();
    expect(document.body.textContent).toContain("No topic yet");
    expect(document.body.textContent).toContain("Listening: 3");

    action("raise-hand")!.click();
    await flush();
    expect(channel.raiseHand).toHaveBeenCalledOnce();
    expect(action("raise-hand")).toBeNull();

    action("lower-hand")!.click();
    await flush();
    expect(channel.lowerHand).toHaveBeenCalledOnce();
    expect(action("raise-hand")).not.toBeNull();
  });

  it("shows a failed action in plain words in the panel", async () => {
    const { channel } = fakeChannel(false);
    channel.raiseHand.mockRejectedValueOnce("NotConnected");
    mount(channel);
    action("raise-hand")!.click();
    await flush();
    expect(document.querySelector('[role="alert"]')!.textContent).toBe(
      "plain: NotConnected",
    );
  });
});

describe("stage panel, moderator", () => {
  it("invites a raised hand to speak", async () => {
    const { channel, setStage } = fakeChannel(true);
    setStage({ speakers: ["host"], hands: ["asker"] });
    mount(channel);
    const hand = document.querySelector('[data-stage-hand="asker"]')!;
    expect(hand.textContent).toContain("name-asker");
    (
      [...hand.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Invite to speak"),
      ) as HTMLButtonElement
    ).click();
    await flush();
    expect(channel.inviteToSpeak).toHaveBeenCalledWith("asker");
    expect(document.querySelector('[data-stage-hand="asker"]')).toBeNull();
    expect(
      document.querySelector('[data-stage-speaker="asker"]'),
    ).not.toBeNull();
  });

  it("sets the topic", async () => {
    const { channel } = fakeChannel(true);
    mount(channel);
    (
      [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Edit topic"),
      ) as HTMLButtonElement
    ).click();
    const field =
      document.querySelector<HTMLInputElement>("[data-topic-field]")!;
    field.value = "Launch Q&A";
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    field.closest("form")!.requestSubmit();
    await flush();
    expect(channel.editStage).toHaveBeenCalledWith("Launch Q&A");
    expect(document.querySelector("[data-stage-topic]")!.textContent).toBe(
      "Launch Q&A",
    );
  });

  it("asks once more before ending the stage", async () => {
    const { channel } = fakeChannel(true);
    mount(channel);
    action("end")!.click();
    expect(channel.endStage).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Everyone leaves the stage.");
    action("end-confirm")!.click();
    await flush();
    expect(channel.endStage).toHaveBeenCalledOnce();
  });

  it("speaks and steps down again", async () => {
    const { channel } = fakeChannel(true);
    mount(channel);
    action("speak")!.click();
    await flush();
    expect(channel.inviteToSpeak).toHaveBeenCalledWith("@me");
    expect(action("speak")).toBeNull();
    action("stop-speaking")!.click();
    await flush();
    expect(channel.moveToAudience).toHaveBeenCalledOnce();
  });
});
