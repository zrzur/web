// Owner, 2026-11-23: calling someone in a DM hid the conversation. The call
// was a floating layer laid over the top 40 % of the message list. It is now
// a block in the page flow above the messages, and the floating card steps
// aside while that block is on screen.
import { ReactiveMap } from "@solid-primitives/map";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const [voiceChannel, setVoiceChannel] = createSignal<{ id: string }>();
const [layout, setLayout] = createSignal<"desktop" | "phone">("desktop");
const room = {};

vi.mock("@revolt/rtc", () => ({
  useVoice: () => ({ channel: voiceChannel, room: () => room }),
}));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ user: { id: "me" } }),
}));
vi.mock("@revolt/common", () => ({
  useDevice: () => ({ layout }),
}));
// the stage itself loads later; here only where it goes and what it shows
vi.mock("@revolt/ui/components/utils/lazyRetry", () => ({
  lazyRetry: () => (props: { display: string }) => (
    <div data-test-stage={props.display} />
  ),
}));
vi.mock("../callCard/VoiceCallCard", () => ({
  InlineCallMark: (props: { channel: { id: string } }) => (
    <i data-inline-mark={props.channel.id} />
  ),
}));

import { DmCallGate, dmCallDisplay } from "./DmCallGate";
import { setPhoneCallView } from "./dmCallView";

function dm(participants: string[] = []) {
  return {
    id: "dm-1",
    type: "DirectMessage",
    voiceParticipants: new ReactiveMap(
      participants.map((id) => [id, { userId: id }]),
    ),
  } as never;
}

let dispose: (() => void) | undefined;
let main: HTMLElement;

function mount(channel: never) {
  document.body.innerHTML = "<main></main>";
  main = document.querySelector("main")!;
  const messages = document.createElement("ol");
  messages.id = "messages";
  dispose = render(() => <DmCallGate channel={channel} />, main);
  main.append(messages);
}

beforeEach(() => {
  setVoiceChannel(undefined);
  setLayout("desktop");
  setPhoneCallView(room, "full");
});
afterEach(() => dispose?.());

describe("a call in a direct message", () => {
  it("shows nothing without a call", () => {
    mount(dm());
    expect(main.querySelector("[data-test-stage]")).toBeNull();
    expect(main.querySelector("[data-inline-mark]")).toBeNull();
  });

  it("is a block in the page above the messages, and the floating card steps aside", () => {
    setVoiceChannel({ id: "dm-1" });
    mount(dm(["me"]));
    const stage = main.querySelector("[data-test-stage='stage']");
    expect(stage).not.toBeNull();
    // in the flow of the channel view, before the message list
    expect(stage!.parentElement).toBe(main);
    expect(
      stage!.compareDocumentPosition(document.getElementById("messages")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(main.querySelector("[data-inline-mark='dm-1']")).not.toBeNull();
  });

  it("offers Join when others are in the call and this device is not", () => {
    mount(dm(["sara"]));
    expect(main.querySelector("[data-test-stage='join']")).not.toBeNull();
    // the floating card is not told to hide: this device has no call here
    expect(main.querySelector("[data-inline-mark]")).toBeNull();
  });

  it("does not offer Join when only this account is listed", () => {
    mount(dm(["me"]));
    expect(main.querySelector("[data-test-stage]")).toBeNull();
  });

  it("a phone shows the call screen, and nothing once minimised", () => {
    setLayout("phone");
    setVoiceChannel({ id: "dm-1" });
    mount(dm(["me"]));
    expect(main.querySelector("[data-test-stage='phone']")).not.toBeNull();
    setPhoneCallView(room, "minimised");
    expect(main.querySelector("[data-test-stage]")).toBeNull();
    // minimised: the floating card leads back to the call
    expect(main.querySelector("[data-inline-mark]")).toBeNull();
  });

  it("a call in another conversation does not show here", () => {
    setVoiceChannel({ id: "dm-2" });
    mount(dm());
    expect(main.querySelector("[data-test-stage]")).toBeNull();
  });
});

describe("what a conversation shows of a call", () => {
  it("covers every case", () => {
    const base = { here: false, othersInCall: false, phone: false };
    expect(dmCallDisplay({ ...base, view: "full" })).toBe("none");
    expect(dmCallDisplay({ ...base, othersInCall: true, view: "full" })).toBe(
      "join",
    );
    expect(dmCallDisplay({ ...base, here: true, view: "minimised" })).toBe(
      "stage",
    );
    expect(
      dmCallDisplay({ ...base, here: true, phone: true, view: "chat" }),
    ).toBe("phone");
    expect(
      dmCallDisplay({ ...base, here: true, phone: true, view: "minimised" }),
    ).toBe("none");
  });
});
