import { Match, Switch } from "solid-js";
import { styled } from "styled-system/jsx";

import { VoiceStatus as APIVoiceStatus } from "@zrzur/sdk/solid";

import {
  screen_share as MdScreenShare,
  video_call as MdVideoChat,
  volume_up as MdVoiceChat,
} from "@revolt/ui/icons/legacy";

import { iconSize } from "../utils";

export type Props = {
  status: APIVoiceStatus;
};

/**
 * Styles for the counter
 */
const VoiceStatusSymbol = styled("div", {
  base: {
    width: "10px",
    height: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    fontSize: "10px",
    fontWeight: 600,

    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface)",
  },
});

/**
 * Voice status SVG graphic
 */
function VoiceGraphic(props: Props) {
  return (
    <Switch>
      <Match when={props.status === "voice"}>
        <circle cx="27" cy="27" r="5" fill="var(--md-sys-color-surface)" />
        <foreignObject x="22" y="22" width="10" height="10">
          <VoiceStatusSymbol>
            <MdVoiceChat {...iconSize(10)} />
          </VoiceStatusSymbol>
        </foreignObject>
      </Match>
      <Match when={props.status === "video"}>
        <circle cx="27" cy="27" r="5" fill="var(--md-sys-color-surface)" />
        <foreignObject x="22" y="22" width="10" height="10">
          <VoiceStatusSymbol>
            <MdVideoChat {...iconSize(10)} />
          </VoiceStatusSymbol>
        </foreignObject>
      </Match>
      <Match when={props.status === "screenshare"}>
        <circle cx="27" cy="27" r="5" fill="var(--md-sys-color-surface)" />
        <foreignObject x="22" y="22" width="10" height="10">
          <VoiceStatusSymbol>
            <MdScreenShare {...iconSize(10)} />
          </VoiceStatusSymbol>
        </foreignObject>
      </Match>
    </Switch>
  );
}

/**
 * Standalone voice status element
 */
export function VoiceStatus(props: Props & { size: string }) {
  return (
    <svg viewBox="22 0 10 10" height={props.size}>
      <VoiceGraphic {...props} />
    </svg>
  );
}

VoiceStatus.Graphic = VoiceGraphic;
