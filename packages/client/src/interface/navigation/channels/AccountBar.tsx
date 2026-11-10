import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { nameStyle } from "@revolt/ui/components/features/profiles/userStyle";
import { Show, createMemo, createSignal } from "solid-js";
import { openMentions } from "../MentionsPanel";
import { UserMenu } from "../servers/UserMenu";
import { pendingPresence } from "../servers/presenceUpdate";

import { useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient, useUser } from "@revolt/client";
import { statusLine } from "@revolt/common/lib/statusWrite";
import { useInstance } from "@revolt/instance";
import { TextWithEmoji } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useVoice } from "@revolt/rtc";
import { Avatar, OverflowingText, UserStatus } from "@revolt/ui";
import { SignalBars } from "@revolt/ui/components/features/voice/SignalBars";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Account / voice control panel: a card floating at the bottom of the left
 * navigation, across the server rail and the channel list, level with the
 * message composer (both use --z-dock-height / --z-dock-gap).
 * Preserves RTC mute / deafen behaviour from VoiceCallCardActions.
 *
 * @param props.compact Only the avatar, for when the channel list is hidden
 */
export function AccountBar(props: { compact?: boolean; overPage?: boolean }) {
  const user = useUser();
  const voice = useVoice();
  const { openModal } = useModals();
  const { t } = useLingui();
  const [menuAnchor, setMenuAnchor] = createSignal<HTMLElement>();

  // same localized presence labels as the member list
  const presenceLabel = (s?: string) =>
    s === "Online"
      ? t`Online`
      : s === "Busy"
        ? t`Do not disturb`
        : s === "Focus"
          ? t`Focus`
          : s === "Idle"
            ? t`Idle`
            : s === "Invisible"
              ? t`Invisible`
              : t`Offline`;

  // custom status if set, otherwise the presence itself (statusMessage only
  // returns custom text, so plain "Online" left the line empty)
  // a status still being saved shows right away
  const presence = () => pendingPresence() ?? user()?.presence;
  const statusText = () =>
    (user()?.status?.text || user()?.statusEmoji
      ? statusLine(user()?.statusEmoji, user()?.status?.text)
      : undefined) ?? presenceLabel(presence());

  // in a call the voice controls join the same card, above the account row
  const inCall = () => !props.compact && !!voice.channel();
  // outside a call there is nothing to mute yet: show the controls neutral
  // instead of red "muted" icons that claim a missing permission
  const offCall = () => !voice.channel();

  // unread mentions across every channel, shown on the Mentions button
  const client = useClient();
  const unreadMentions = createMemo(() =>
    [...client().channels.values()].reduce(
      (sum, channel) => sum + (channel.mentions?.size ?? 0),
      0,
    ),
  );

  return (
    <Bar
      data-account-panel
      data-compact={!!props.compact}
      data-over-page={props.overPage && !props.compact ? "" : undefined}
      data-in-call={inCall()}
    >
      <Show when={inCall()}>
        <VoiceSection />
      </Show>
      <AccountRow>
        <button
          class={identity()}
          // with a name on show that name is the label, the tooltip describes
          aria-label={props.compact ? t`Profile and status` : undefined}
          ref={setMenuAnchor}
          use:floating={{
            tooltip: {
              placement: "top",
              content: t`Profile and status`,
            },
          }}
        >
          <AvatarDecoration
            decoration={user()?.style?.decoration}
            file={user()?.style?.decoration_file}
            size={props.compact ? 44 : 40}
          >
            <Avatar
              size={props.compact ? 44 : 40}
              src={user()?.animatedAvatarURL}
              fallback={user()?.username}
              holepunch="bottom-right"
              overlay={<UserStatus.Graphic status={presence()} />}
            />
          </AvatarDecoration>
          <Show when={!props.compact}>
            <Meta>
              <Name>
                <OverflowingText>
                  <span style={nameStyle(user()?.style)}>
                    {user()?.displayName ?? user()?.username ?? ""}
                  </span>
                </OverflowingText>
              </Name>
              <StatusLine>
                <OverflowingText>
                  <TextWithEmoji content={statusText()} />
                </OverflowingText>
              </StatusLine>
            </Meta>
          </Show>
        </button>
        <UserMenu anchor={menuAnchor} />

        <Show when={!props.compact}>
          <Controls>
            <button
              class={controlButton()}
              aria-label={
                unreadMentions()
                  ? t`Mentions, ${unreadMentions()} unread`
                  : t`Mentions`
              }
              aria-haspopup="dialog"
              onClick={openMentions}
              data-active="false"
              data-danger="false"
              use:floating={{
                tooltip: { placement: "top", content: t`Mentions` },
              }}
            >
              <Icon name="at" size={20} />
              <Show when={unreadMentions()}>
                <MentionCount aria-hidden="true">
                  {unreadMentions() > 99 ? "99+" : unreadMentions()}
                </MentionCount>
              </Show>
            </button>
            <button
              class={controlButton()}
              aria-label={
                offCall()
                  ? t`Not connected to voice`
                  : voice.unmuted()
                    ? t`Mute`
                    : t`Unmute`
              }
              aria-pressed={offCall() ? undefined : !voice.unmuted()}
              data-active={voice.unmuted() ? "true" : "false"}
              data-danger={offCall() || voice.unmuted() ? "false" : "true"}
              disabled={!voice.speakingPermission}
              onClick={() => voice.toggleMute()}
              use:floating={{
                tooltip: {
                  placement: "top",
                  content: offCall()
                    ? t`Not connected to voice`
                    : voice.speakingPermission
                      ? voice.unmuted()
                        ? t`Mute`
                        : t`Unmute`
                      : t`Missing permission`,
                },
              }}
            >
              <Show
                when={offCall() || voice.unmuted()}
                fallback={<Icon name="microphone-slash" size={20} />}
              >
                <Icon name="microphone" size={20} />
              </Show>
            </button>

            <button
              class={controlButton()}
              aria-label={
                offCall()
                  ? t`Not connected to voice`
                  : voice.deafen()
                    ? t`Undeafen`
                    : t`Deafen`
              }
              aria-pressed={
                offCall()
                  ? undefined
                  : voice.deafen() || !voice.listenPermission
              }
              data-active={
                voice.deafen() || !voice.listenPermission ? "false" : "true"
              }
              data-danger={
                !offCall() && (voice.deafen() || !voice.listenPermission)
                  ? "true"
                  : "false"
              }
              disabled={!voice.listenPermission}
              onClick={() => voice.toggleDeafen()}
              use:floating={{
                tooltip: {
                  placement: "top",
                  content: offCall()
                    ? t`Not connected to voice`
                    : voice.listenPermission
                      ? voice.deafen()
                        ? t`Undeafen`
                        : t`Deafen`
                      : t`Missing permission`,
                },
              }}
            >
              <Show
                when={!offCall() && (voice.deafen() || !voice.listenPermission)}
                fallback={<Icon name="headphones" size={20} />}
              >
                <Icon name="headphones-slash" size={20} />
              </Show>
            </button>

            <button
              class={controlButton()}
              aria-label={t`User settings`}
              onClick={() => openModal({ type: "settings", config: "user" })}
              use:floating={{
                tooltip: {
                  placement: "top",
                  content: t`User settings`,
                },
              }}
            >
              <Icon name="gear-six" size={20} />
            </button>
          </Controls>
        </Show>
      </AccountRow>
    </Bar>
  );
}

/**
 * Voice part of the account card while in a call: connection state, where
 * you are (click to go back to the room), disconnect, camera and screen share
 */
function VoiceSection() {
  const voice = useVoice();
  const navigate = useNavigate();
  const { t } = useLingui();
  const { limits } = useInstance();

  // until the call is connected a click would be ignored, so say so
  const notReady = () => voice.state() !== "CONNECTED";
  const cameraDisabled = () =>
    notReady() || !limits().video || (!voice.videoPermission && !voice.video());
  const screenDisabled = () =>
    notReady() ||
    !limits().video ||
    (!voice.videoPermission && !voice.screenshare());

  const status = () => {
    switch (voice.state()) {
      case "CONNECTED":
        return t`Voice connected`;
      case "RECONNECTING":
        return t`Reconnecting`;
      case "DISCONNECTED":
        return t`Disconnected`;
      default:
        return t`Connecting`;
    }
  };

  const location = () =>
    [
      voice.channel()?.name ?? voice.channel()?.recipient?.username,
      voice.channel()?.server?.name,
    ]
      .filter(Boolean)
      .join(" / ");

  return (
    <VoicePanel data-voice-panel data-state={voice.state()}>
      <VoiceHead>
        <button
          class={voiceTarget()}
          onClick={() => navigate(voice.channel()?.path ?? "")}
          use:floating={{
            tooltip: { placement: "top", content: t`Return to voice channel` },
          }}
        >
          <VoiceStatus>
            <SignalBars state={voice.state()} size={16} />
            <span>{status()}</span>
          </VoiceStatus>
          <VoiceLocation>
            <OverflowingText>{location()}</OverflowingText>
          </VoiceLocation>
        </button>
        <button
          class={controlButton()}
          data-danger="true"
          data-voice-control="disconnect"
          aria-label={t`Disconnect`}
          onClick={() => voice.disconnect()}
          use:floating={{
            tooltip: { placement: "top", content: t`Disconnect` },
          }}
        >
          <Icon name="phone-disconnect" size={20} filled />
        </button>
      </VoiceHead>
      <VoiceActions>
        <button
          class={voiceAction()}
          data-voice-control="camera"
          aria-pressed={!!voice.video()}
          aria-disabled={cameraDisabled()}
          onClick={() => !cameraDisabled() && voice.toggleCamera()}
          use:floating={{
            tooltip: {
              placement: "top",
              content: voice.video() ? t`Stop camera` : t`Start camera`,
            },
          }}
        >
          <Show
            when={voice.video()}
            fallback={<Icon name="video-camera-slash" size={20} />}
          >
            <Icon name="video-camera" size={20} />
          </Show>
          <span>{t`Camera`}</span>
        </button>
        <button
          class={voiceAction()}
          data-voice-control="screenshare"
          aria-pressed={!!voice.screenshare()}
          aria-disabled={screenDisabled()}
          onClick={() => !screenDisabled() && voice.toggleScreenshare()}
          use:floating={{
            tooltip: {
              placement: "top",
              content: voice.screenshare() ? t`Stop sharing` : t`Share screen`,
            },
          }}
        >
          <Icon name="monitor-arrow-up" size={20} />
          <span>{t`Screen`}</span>
        </button>
      </VoiceActions>
    </VoicePanel>
  );
}

const VoicePanel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "8px 6px 10px 8px",
    borderBottom: "1px solid var(--z-border-subtle)",
  },
});

const VoiceHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
  },
});

const VoiceActions = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
  },
});

const voiceAction = cva({
  base: {
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    border: "none",
    borderRadius: "8px",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    background: "color-mix(in srgb, var(--z-fg-primary) 7%, transparent)",
    transition: "background-color .12s ease, color .12s ease",

    _hover: {
      color: "var(--z-fg-primary)",
      background: "color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },
    "&[aria-pressed='true']": {
      color: "var(--z-on-accent)",
      background: "var(--z-accent-fill, var(--z-accent))",
    },
    "&[aria-disabled='true']": {
      opacity: 0.4,
      cursor: "not-allowed",
    },
  },
});

const AccountRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--z-space-2, 8px)",
    height: "calc(var(--z-dock-height, 56px) - 2px)",
    paddingInline: "8px 6px",
  },
});

const voiceTarget = cva({
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "1px",
    padding: "4px 6px",
    marginInlineStart: "-6px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    textAlign: "start",

    _hover: {
      background:
        "color-mix(in srgb, var(--z-fg-primary, #E6E1EE) 6%, transparent)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },
  },
});

const VoiceStatus = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: "16px",
    color: "var(--z-presence-online)",
    "--z-icon-color": "currentColor",

    "[data-state='CONNECTING'] &, [data-state='RECONNECTING'] &": {
      color: "var(--z-status-warning)",
    },
    "[data-state='DISCONNECTED'] &": {
      color: "var(--z-status-error)",
    },
  },
});

const VoiceLocation = styled("div", {
  base: {
    maxWidth: "100%",
    fontSize: "11px",
    lineHeight: "14px",
    color: "var(--z-fg-muted)",
  },
});

const Bar = styled("div", {
  base: {
    position: "absolute",
    zIndex: 3,
    insetInline: "var(--z-dock-gap, 8px)",
    bottom: "var(--z-dock-gap, 8px)",
    // grows upwards when the voice section is shown
    minHeight: "var(--z-dock-height, 56px)",

    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    margin: 0,
    // visible, so an avatar decoration can reach past the card
    overflow: "visible",
    borderRadius: "var(--z-dock-radius, 12px)",
    // same chrome as the message composer (--z-dock-*)
    background: "var(--z-dock-bg)",
    border: "1px solid var(--z-dock-border)",
    boxShadow: "var(--z-dock-lift)",
    boxSizing: "border-box",

    // full pages (Discover, Designs) put their own menu where the channel
    // list is: the card spans the rail and that menu, as on every page
    "&[data-over-page]": {
      insetInlineEnd: "auto",
      width:
        "calc(100% + var(--z-sidebar-width, 260px) - 2 * var(--z-dock-gap, 8px))",
    },

    // channel list hidden: no card squeezed into the rail, just the avatar,
    // centred like the server icons above it
    "&[data-compact='true']": {
      justifyContent: "center",
      insetInline: 0,
      paddingInline: 0,
      background: "transparent",
      border: "none",
      boxShadow: "none",
    },
    "&[data-compact='true'] > div": {
      justifyContent: "center",
      paddingInline: 0,
    },
    "&[data-compact='true'] > div > button": {
      flex: "0 0 auto",
      margin: 0,
      padding: "4px",
      borderRadius: "12px",
    },
  },
});

const identity = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--z-space-2, 8px)",
    minWidth: 0,
    flex: 1,
    padding: "4px 6px",
    marginInlineStart: "-6px",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    borderRadius: "6px",
    textAlign: "start",

    _hover: {
      background:
        "color-mix(in srgb, var(--z-fg-primary, #E6E1EE) 6%, transparent)",
    },

    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },
  },
});

const Meta = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    gap: "1px",
  },
});

const Name = styled("div", {
  base: {
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "16px",
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
  },
});

const StatusLine = styled("div", {
  base: {
    fontSize: "12px",
    lineHeight: "14px",
    // the bar is lifted above the sidebar; secondary keeps 4.5:1 there
    color: "var(--z-fg-secondary, var(--md-sys-color-on-surface-variant))",
  },
});

/** Unread mentions on the Mentions button */
const MentionCount = styled("span", {
  base: {
    position: "absolute",
    top: "-3px",
    insetInlineEnd: "-4px",
    minWidth: "16px",
    height: "16px",
    paddingInline: "4px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1,
    color: "var(--z-on-mention-badge, #FFFFFF)",
    background: "var(--z-mention-badge, #C2337A)",
    boxShadow: "0 0 0 2px var(--z-bg-dock, var(--z-bg-raised))",
    pointerEvents: "none",
  },
});

const Controls = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    flexShrink: 0,
  },
});

const controlButton = cva({
  base: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    padding: 0,
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-icon-neutral)",
    cursor: "pointer",
    transition: "background-color 0.12s ease, color 0.12s ease",

    // colour only, no shape behind the icon
    _hover: {
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-icon-active)",
    },

    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },

    _disabled: {
      opacity: 0.4,
      cursor: "not-allowed",
    },

    "&[data-danger='true']": {
      color: "var(--z-danger, var(--md-sys-color-error, #F87171))",
      "--z-icon-color": "var(--z-icon-danger)",
    },
    "&[data-danger='true']:hover": {
      color: "var(--z-danger)",
      "--z-icon-color": "var(--z-icon-danger)",
    },
  },
});
