import { JSX, Show } from "solid-js";

import { useVoice } from "..";

/**
 * Render only if in a voice call (and optionally check if channelId matches)
 *
 * Like <Show /> exposes fallback prop
 */
export function InRoom(props: {
  channelId?: string;
  children: JSX.Element;
  fallback?: JSX.Element;
}) {
  const voice = useVoice();

  return (
    <Show
      when={
        voice.room() &&
        voice.state() === "CONNECTED" &&
        (!props.channelId || props.channelId === voice.channel()?.id)
      }
      fallback={props.fallback}
    >
      {props.children}
    </Show>
  );
}
