import {
  JSX,
  Show,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";

import { createResizeObserver } from "@solid-primitives/resize-observer";
import { Channel } from "@zrzur/sdk/solid";

import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { SlideState } from "@revolt/ui/components/navigation/SlideDrawer";
import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";

// The card itself (placing, dragging, the call views) loads the first time
// it is needed: kept out of the files the app installs up front
// (scripts/precacheShell.mjs). A file that does not arrive is asked for
// again once; the call goes on without the card if it still fails.
const VoiceCallCardFloat = lazyRetry(
  () => import("./VoiceCallCardFloat"),
  () => null,
);

export type Info = {
  channel: Channel;
  pos: DOMRect;
  parentRect: DOMRect;
  drawer?: SlideState;
  /** voice channel page: the call fills the whole channel view */
  stage?: boolean;
};

const callCardContext = createContext<(info?: Info) => void>();

/** Voice call card context */
export function VoiceCallCardContext(props: { children: JSX.Element }) {
  const voice = useVoice();
  const [info, setInfo] = createSignal<Info>();

  return (
    <callCardContext.Provider value={setInfo}>
      {props.children}
      {/* nothing to place until a channel page marks a spot or a call starts */}
      <Show when={info() || voice.channel()}>
        <VoiceCallCardFloat info={info} />
      </Show>
    </callCardContext.Provider>
  );
}

/** 'Marker' to send position information for mounting the floating call card */
export function VoiceChannelCallCardMount(props: {
  channel: Channel;
  stage?: boolean;
}) {
  const voice = useVoice();
  const state = useState();
  const setInfo = useContext(callCardContext)!;
  let ref: HTMLDivElement | undefined;

  function updateInfo() {
    const vc = voice.channel();
    setInfo(
      !vc || vc.id === props.channel.id
        ? {
            channel: props.channel,
            pos: ref!.getBoundingClientRect(),
            parentRect: ref!.parentElement!.getBoundingClientRect(),
            drawer: state.appDrawer()?.state,
            stage: props.stage,
          }
        : undefined,
    );
  }

  createEffect(updateInfo);

  onMount(() => {
    const target = ref?.parentElement;
    if (!target) return;

    createResizeObserver(target, updateInfo);
  });
  onCleanup(() => {
    setInfo();
  });

  return <div ref={ref!} />;
}
