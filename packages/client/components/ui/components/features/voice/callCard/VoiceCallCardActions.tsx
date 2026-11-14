import { JSX, Show, lazy, splitProps } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useInstance } from "@revolt/instance";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { Icon } from "@revolt/ui/icons/Icon";

// the soundboard button and its state are not in the app's first download
const SoundboardButton = lazy(() => import("../soundboard/SoundboardButton"));

export function VoiceCallCardActions(props: { size: "xs" | "sm" }) {
  const voice = useVoice();
  const state = useState();
  const { t } = useLingui();
  const { limits } = useInstance();

  const iconSize = () => (props.size === "xs" ? 18 : 22);

  return (
    <Actions
      compact={props.size === "xs"}
      data-voice-controls
      data-voice-channel={voice.channel()?.id}
      data-server-muted={voice.serverMuted}
      data-server-deafened={voice.serverDeafened}
      data-mic-preference={state.voice.micOn}
      data-deafen-preference={state.voice.deafen}
    >
      <ControlButton
        size={props.size}
        tone={voice.unmuted() ? "neutral" : "off"}
        data-voice-control="microphone"
        aria-pressed={!voice.unmuted()}
        disabled={!voice.speakingPermission}
        label={
          voice.serverMuted
            ? t`Server muted`
            : voice.speakingPermission
              ? voice.unmuted()
                ? t`Mute`
                : t`Unmute`
              : t`Missing permission`
        }
        onClick={() => voice.toggleMute()}
      >
        <Show
          when={voice.unmuted()}
          fallback={<Icon name="microphone-slash" size={iconSize()} />}
        >
          <Icon name="microphone" size={iconSize()} />
        </Show>
      </ControlButton>
      {/* the floating card keeps two buttons: microphone and hang up */}
      <Show when={props.size !== "xs"}>
        <ControlButton
          size={props.size}
          tone={voice.deafen() || !voice.listenPermission ? "off" : "neutral"}
          data-voice-control="deafen"
          aria-pressed={voice.deafen()}
          disabled={!voice.listenPermission}
          label={
            voice.serverDeafened
              ? t`Server deafened`
              : voice.listenPermission
                ? voice.deafen()
                  ? t`Undeafen`
                  : t`Deafen`
                : t`Missing permission`
          }
          onClick={() => voice.toggleDeafen()}
        >
          <Show
            when={voice.deafen() || !voice.listenPermission}
            fallback={<Icon name="headphones" size={iconSize()} />}
          >
            <Icon name="headphones-slash" size={iconSize()} />
          </Show>
        </ControlButton>
        <ControlButton
          size={props.size}
          tone={limits().video && voice.video() ? "on" : "neutral"}
          data-voice-control="camera"
          aria-pressed={!!voice.video()}
          disabled={
            voice.state() !== "CONNECTED" ||
            !limits().video ||
            (!voice.videoPermission && !voice.video())
          }
          label={
            limits().video
              ? voice.video()
                ? t`Stop camera`
                : t`Start camera`
              : t`Camera unavailable`
          }
          onClick={() => limits().video && voice.toggleCamera()}
        >
          <Show
            when={voice.video()}
            fallback={<Icon name="video-camera-slash" size={iconSize()} />}
          >
            <Icon name="video-camera" size={iconSize()} />
          </Show>
        </ControlButton>
        <ControlButton
          size={props.size}
          tone={limits().video && voice.screenshare() ? "on" : "neutral"}
          data-voice-control="screenshare"
          aria-pressed={!!voice.screenshare()}
          disabled={
            voice.state() !== "CONNECTED" ||
            !limits().video ||
            (!voice.videoPermission && !voice.screenshare())
          }
          label={
            limits().video
              ? voice.screenshare()
                ? t`Stop sharing`
                : t`Share screen`
              : t`Screen share unavailable`
          }
          onClick={() => limits().video && voice.toggleScreenshare()}
        >
          <Icon name="monitor-arrow-up" size={iconSize()} />
        </ControlButton>
        {/* server calls only; the button loads with the first one */}
        <Show when={voice.channel()?.server}>
          <SoundboardButton size={props.size} />
        </Show>
      </Show>
      <ControlButton
        size={props.size}
        tone="danger"
        data-voice-control="disconnect"
        label={t`Disconnect`}
        onClick={() => voice.disconnect()}
      >
        <Icon name="phone-disconnect" size={iconSize()} filled />
      </ControlButton>
    </Actions>
  );
}

type ControlProps = {
  size: "xs" | "sm";
  tone?: "neutral" | "off" | "on" | "danger";
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: JSX.Element;
  "aria-pressed"?: boolean;
  [data: `data-${string}`]: unknown;
};

/**
 * Round call control (mute, deafen, camera, share, disconnect)
 */
export function ControlButton(props: ControlProps) {
  const [local, rest] = splitProps(props, [
    "size",
    "tone",
    "label",
    "disabled",
    "onClick",
    "children",
  ]);

  return (
    <button
      {...rest}
      type="button"
      class={control({ size: local.size, tone: local.tone ?? "neutral" })}
      aria-label={local.label}
      aria-disabled={local.disabled}
      onClick={() => !local.disabled && local.onClick()}
      use:floating={{
        tooltip: {
          placement: "top",
          content: local.label,
        },
      }}
    >
      {local.children}
    </button>
  );
}

const control = cva({
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "var(--borderRadius-full)",
    cursor: "pointer",
    transition:
      "background-color .15s ease, color .15s ease, transform .1s ease",
    "--z-icon-color": "currentColor",

    "&:active:not([aria-disabled='true'])": {
      transform: "scale(.94)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&[aria-disabled='true']": {
      opacity: 0.4,
      cursor: "not-allowed",
    },
  },
  variants: {
    size: {
      xs: { width: "34px", height: "34px" },
      sm: { width: "48px", height: "48px" },
    },
    tone: {
      neutral: {
        color: "var(--z-fg-primary)",
        background:
          "color-mix(in srgb, var(--z-fg-primary) 10%, var(--z-bg-raised))",
        "&:hover:not([aria-disabled='true'])": {
          background:
            "color-mix(in srgb, var(--z-fg-primary) 18%, var(--z-bg-raised))",
        },
      },
      off: {
        color: "var(--z-danger)",
        background: "var(--z-danger-muted)",
        "&:hover:not([aria-disabled='true'])": {
          background:
            "color-mix(in srgb, var(--z-danger) 30%, var(--z-bg-raised))",
        },
      },
      on: {
        color: "var(--z-on-accent)",
        background: "var(--z-accent-fill, var(--z-accent))",
        "&:hover:not([aria-disabled='true'])": {
          background: "var(--z-accent-hover)",
        },
      },
      danger: {
        color: "var(--z-on-accent, #fff)",
        background: "var(--z-danger-strong, var(--z-danger))",
        "&:hover:not([aria-disabled='true'])": {
          background: "var(--z-danger-hover, #BF2424)",
        },
      },
    },
  },
  compoundVariants: [
    {
      size: "sm",
      tone: "danger",
      css: { width: "64px" },
    },
    {
      size: "xs",
      tone: "danger",
      css: { width: "44px" },
    },
  ],
});

const Actions = styled("div", {
  base: {
    flexShrink: 0,
    zIndex: 2,

    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px",
    width: "fit-content",
    maxWidth: "100%",
    alignSelf: "center",
    justifyContent: "center",
    flexWrap: "wrap",

    borderRadius: "var(--borderRadius-full)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    boxShadow: "var(--z-shadow-md)",
  },
  variants: {
    compact: {
      true: {
        gap: "6px",
        padding: "4px",
        boxShadow: "none",
      },
    },
  },
});
