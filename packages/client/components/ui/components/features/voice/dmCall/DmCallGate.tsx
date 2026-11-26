import { Show, Suspense } from "solid-js";

import type { Channel } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { useVoice } from "@revolt/rtc";
import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";

import { InlineCallMark } from "../callCard/VoiceCallCard";

import { type PhoneCallView, phoneCallView } from "./dmCallView";

// The stage, the phone call screen and LiveKit load the first time a call in
// a conversation is on screen: kept out of the files the app installs up
// front (scripts/precacheShell.mjs). A file that does not arrive is asked for
// again once; the call goes on without the stage if it still fails.
const DmCallStage = lazyRetry(
  () => import("./DmCallStage"),
  () => null,
);

/** What a direct message or group shows of a call */
export type DmCallDisplay = "none" | "join" | "stage" | "phone";

/**
 * - none: no call here, or a phone minimised it (the floating card leads back)
 * - join: others are in a call here, this device is not
 * - stage: this device is in the call (desktop and tablet)
 * - phone: this device is in the call on a phone (full screen or chat sheet)
 */
export function dmCallDisplay(input: {
  here: boolean;
  othersInCall: boolean;
  phone: boolean;
  view: PhoneCallView;
}): DmCallDisplay {
  if (input.here) {
    if (!input.phone) return "stage";
    return input.view === "minimised" ? "none" : "phone";
  }
  return input.othersInCall ? "join" : "none";
}

/**
 * The call in a direct message or group, above the conversation and in the
 * page flow: the messages move down instead of lying under a floating card,
 * so the chat stays readable and the composer works during the call.
 */
export function DmCallGate(props: { channel: Channel }) {
  const voice = useVoice();
  const client = useClient();
  const { layout } = useDevice();

  const here = () => voice.channel()?.id === props.channel.id;
  const display = () =>
    dmCallDisplay({
      here: here(),
      othersInCall: [...props.channel.voiceParticipants.keys()].some(
        (id) => id !== client().user?.id,
      ),
      phone: layout() === "phone",
      view: phoneCallView(voice.room()),
    });

  return (
    <Show when={display() !== "none"}>
      {/* the floating card steps aside while the call is shown here */}
      <Show when={here()}>
        <InlineCallMark channel={props.channel} />
      </Show>
      <Suspense>
        <DmCallStage
          channel={props.channel}
          display={display() as Exclude<DmCallDisplay, "none">}
        />
      </Suspense>
    </Show>
  );
}

/** Phones: the channel's own header gives way to the call's top bar */
export function useDmCallCoversHeader(channel: () => Channel) {
  const voice = useVoice();
  const { layout } = useDevice();
  return () =>
    layout() === "phone" &&
    voice.channel()?.id === channel().id &&
    phoneCallView(voice.room()) !== "minimised";
}
