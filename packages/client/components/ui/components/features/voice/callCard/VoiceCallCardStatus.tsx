import { Trans } from "@lingui/solid/macro";
import { Show } from "solid-js";
import { styled } from "styled-system/jsx";

import { useVoice } from "@revolt/rtc";

import { SignalBars } from "../SignalBars";

export function VoiceCallCardStatus(props: { pip?: boolean }) {
  const voice = useVoice();

  const text = () => {
    switch (voice.state()) {
      case "CONNECTED":
        return <Trans>Connected</Trans>;
      case "CONNECTING":
        return <Trans>Connecting</Trans>;
      case "DISCONNECTED":
        return <Trans>Disconnected</Trans>;
      case "RECONNECTING":
        return <Trans>Reconnecting</Trans>;
      default:
        return null;
    }
  };

  return (
    <Status
      status={voice.state()}
      data-voice-state={voice.state()}
      tabIndex={0}
      pip={props.pip}
    >
      <Show when={voice.error()}>
        <span role="alert">{voice.error()}</span>
      </Show>
      <SignalBars state={voice.state()} size={18} />{" "}
      <FadeOut fade={voice.state() === "CONNECTED"}>{text()}</FadeOut>
    </Status>
  );
}

const FadeOut = styled("div", {
  base: {
    paddingLeft: "var(--gap-md)",
  },
  variants: {
    fade: {
      true: {
        opacity: 0,
        fontSize: 0,
        paddingLeft: 0,
        transition:
          "opacity .3s 5s ease, font-size .3s 6s, padding-left .3s 6s",
      },
    },
  },
});

const Status = styled("div", {
  base: {
    flexShrink: 0,

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    minWidth: 0,
    fontSize: "14px",
    fontWeight: 600,
    "--z-icon-color": "currentColor",

    "& > [role=alert]": {
      minWidth: 0,
      marginInlineEnd: "var(--gap-md)",
      fontSize: "13px",
      lineHeight: "18px",
      whiteSpace: "normal",
      color: "var(--z-status-warning)",
    },

    // the status text fades after a few seconds; pointing at it (mouse) or
    // touching it (a tap focuses it) brings it back
    "&:is(:focus-within, :active) div": {
      opacity: 1,
      fontSize: "inherit",
      paddingLeft: "var(--gap-md)",
      transition: "opacity 0s 0s, font-size 0s 0s, padding-left 0s 0s",
    },
    _hover: {
      "& div": {
        opacity: 1,
        fontSize: "inherit",
        paddingLeft: "var(--gap-md)",
        transition: "opacity 0s 0s, font-size 0s 0s, padding-left 0s 0s",
      },
    },
  },
  variants: {
    status: {
      READY: {},
      CONNECTED: {
        color: "var(--z-presence-online)",
      },
      CONNECTING: {
        color: "var(--z-fg-muted)",
      },
      DISCONNECTED: {
        color: "var(--z-fg-muted)",
      },
      RECONNECTING: {
        color: "var(--z-fg-muted)",
      },
    },
    pip: {
      true: {
        position: "absolute",
        insetInlineStart: "var(--gap-md)",
        top: "var(--gap-md)",
      },
    },
  },
});
