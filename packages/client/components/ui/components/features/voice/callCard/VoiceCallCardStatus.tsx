import { Trans, useLingui } from "@lingui/solid/macro";
import { Show } from "solid-js";
import { styled } from "styled-system/jsx";

import { useVoice } from "@revolt/rtc";
import { Button } from "@revolt/ui/components/design/Button";

import { SignalBars } from "../SignalBars";

/**
 * @param props.noticesOnly Leave out the signal bars and "Connected": the
 *   voice card at the bottom of the channel list already shows them (desktop)
 */
export function VoiceCallCardStatus(props: {
  pip?: boolean;
  noticesOnly?: boolean;
}) {
  const voice = useVoice();
  const { t } = useLingui();

  const notice = () => {
    switch (voice.notice()) {
      case "reconnected":
        return t`Reconnected`;
      case "inputFallback":
        return t`Microphone unplugged. Using the default microphone.`;
      case "inputRestored":
        return t`Your microphone is back.`;
      case "outputFallback":
        return t`Speaker unplugged. Using the default speaker.`;
      case "outputRestored":
        return t`Your speaker is back.`;
      default:
        return undefined;
    }
  };

  const text = () => {
    switch (voice.state()) {
      case "CONNECTED":
        return <Trans>Connected</Trans>;
      case "CONNECTING":
        return <Trans>Connecting</Trans>;
      case "DISCONNECTED":
        return <Trans>Disconnected</Trans>;
      case "RECONNECTING":
        return <Trans>Connection lost. Reconnecting…</Trans>;
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
      <Show when={!props.noticesOnly}>
        <SignalBars state={voice.state()} size={18} />{" "}
        <FadeOut fade={voice.state() === "CONNECTED"}>{text()}</FadeOut>
      </Show>
      <Notice role="status">{notice()}</Notice>
      {/* talking was turned on with the global toggle (desktop app) */}
      <Show when={voice.pttLatched()}>
        <Notice data-talk-latched>
          <Trans>Talking (toggle on)</Trans>
        </Notice>
      </Show>
      <Show
        when={
          voice.state() === "DISCONNECTED" &&
          voice.channel() &&
          voice.canRejoin()
        }
      >
        {/* after reconnecting failed: one press joins the same channel */}
        <RejoinSlot>
          <Button size="sm" onPress={() => voice.rejoin()}>
            <Trans>Rejoin</Trans>
          </Button>
        </RejoinSlot>
      </Show>
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

/** Reconnected, device unplugged: stays a few seconds, read out once */
const Notice = styled("span", {
  base: {
    minWidth: 0,
    marginInlineStart: "var(--gap-md)",
    fontSize: "13px",
    lineHeight: "18px",
    fontWeight: 500,
    color: "var(--z-fg-secondary)",
    whiteSpace: "normal",
    "&:empty": { display: "none" },
  },
});

const RejoinSlot = styled("span", {
  base: { marginInlineStart: "var(--gap-md)" },
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
