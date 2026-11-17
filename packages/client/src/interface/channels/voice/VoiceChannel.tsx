import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  on,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import { useUsers } from "@revolt/markdown/users";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { voiceOccupancy } from "@revolt/rtc/moderation";
import { useState } from "@revolt/state";
import { Avatar, Header } from "@revolt/ui";
import { VoiceChannelCallCardMount } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";
import { Icon } from "@revolt/ui/icons/Icon";

import { ChannelHeader } from "../ChannelHeader";
import { ChannelPageProps } from "../ChannelPage";
import { pullCallDown } from "./callPull";
import "./phoneCall.css";

/**
 * Server voice channel: the call alone, no chat panel on this page (owner,
 * 2026-11-09). Viewing a channel never changes the active call. Joining
 * requires an explicit action; leaving the call from here returns to the
 * server.
 */
export function VoiceChannel(props: ChannelPageProps) {
  const voice = useVoice();
  const navigate = useNavigate();

  const inThisCall = () => voice.channel()?.id === props.channel.id;
  // left the call while looking at it: nothing to show here any more
  createEffect(
    on(
      () => [props.channel.id, inThisCall()] as const,
      ([id, now], previous) => {
        if (previous?.[0] === id && previous[1] && !now && !voice.error())
          navigate(`/server/${props.channel.serverId}`);
      },
    ),
  );

  const device = useDevice();
  const state = useState();
  const phoneCall = () => device.layout() === "phone" && inThisCall();
  // the call card is drawn over the stage from outside it: the phone look of
  // its tiles and controls hangs on <html> (phoneCall.css)
  createEffect(() => {
    if (!phoneCall()) return;
    document.documentElement.setAttribute("data-phone-call", "");
    onCleanup(() =>
      document.documentElement.removeAttribute("data-phone-call"),
    );
    // drag the call down to put it aside: the call goes on, the lists come
    // back (the same as the arrow in the top row)
    onCleanup(
      pullCallDown(() => {
        state.appDrawer()?.setShown(false);
      }),
    );
  });

  return (
    <>
      <Show
        when={phoneCall()}
        fallback={
          <Header placement="primary">
            <ChannelHeader channel={props.channel} />
          </Header>
        }
      >
        <CallTop {...props} />
      </Show>
      <Row>
        <Stage data-voice-stage={props.channel.id}>
          <Show when={inThisCall()} fallback={<Unavailable {...props} />}>
            <VoiceChannelCallCardMount channel={props.channel} stage />
          </Show>
        </Stage>
      </Row>
    </>
  );
}

/**
 * Phones, in the call: back to the channel list, the room's name, then the
 * speaker (hear or not), an invite and the way to the server's chat.
 *
 * [v] [speaker Lounge]            [speaker] [invite] [chat]
 */
function CallTop(props: ChannelPageProps) {
  const { t } = useLingui();
  const voice = useVoice();
  const state = useState();
  const navigate = useNavigate();
  const { openModal } = useModals();

  const chat = () =>
    props.channel.server?.channels.find((channel) => !channel.isVoice);

  return (
    <Top data-call-top>
      <TopButton
        type="button"
        aria-label={t`Back`}
        onClick={() => state.appDrawer()?.setShown(false)}
      >
        <Icon name="caret-down" size={22} />
      </TopButton>
      <RoomPill>
        <Icon name="speaker-high" size={18} />
        <span dir="auto">{props.channel.name}</span>
      </RoomPill>
      <span style={{ flex: 1 }} />
      <TopButton
        type="button"
        data-off={voice.deafen() ? "" : undefined}
        aria-pressed={voice.deafen()}
        aria-label={voice.deafen() ? t`Undeafen` : t`Deafen`}
        aria-disabled={!voice.listenPermission}
        onClick={() => voice.listenPermission && voice.toggleDeafen()}
      >
        <Icon
          name={voice.deafen() ? "speaker-slash" : "speaker-high"}
          size={22}
        />
      </TopButton>
      <Show when={props.channel.havePermission("InviteOthers")}>
        <TopButton
          type="button"
          aria-label={t`Create invite`}
          onClick={() =>
            openModal({ type: "create_invite", channel: props.channel })
          }
        >
          <Icon name="user-plus" size={22} />
        </TopButton>
      </Show>
      <Show when={chat()}>
        <TopButton
          type="button"
          aria-label={t`Text channels`}
          onClick={() =>
            navigate(`/server/${props.channel.serverId}/channel/${chat()!.id}`)
          }
        >
          <Icon name="chat-circle" size={22} />
        </TopButton>
      </Show>
    </Top>
  );
}

const Top = styled("div", {
  base: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "calc(8px + var(--z-phone-top-gap, 0px)) 14px 8px",
    background: "var(--z-bg-app)",
  },
});

const TopButton = styled("button", {
  base: {
    flex: "none",
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-raised)",
    "--z-icon-color": "currentColor",
    transition: "background-color .15s ease, color .15s ease, scale .1s ease",
    _motionReduce: { transition: "none" },
    "&:active:not([aria-disabled='true'])": { scale: "0.94" },
    // The row is one family: every button the same tile. Only "you hear
    // nothing" stands out, in the colour the call's own controls use for
    // "off" (a white tile for "sound is on" read as a different kind of
    // button; owner, 2026-11-17).
    "&[data-off]": {
      color: "var(--z-danger)",
      background: "var(--z-danger-muted)",
    },
    "&[aria-disabled='true']": { opacity: 0.4 },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const RoomPill = styled("div", {
  base: {
    minWidth: 0,
    height: "44px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    paddingInline: "12px",
    borderRadius: "14px",
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-raised)",
    "--z-icon-color": "var(--z-fg-muted)",
    "& > span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Row = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexGrow: 1,
    minHeight: 0,
    minWidth: 0,
  },
});

/**
 * Preview and explicit join action when this channel is not the active call:
 * the room, who is in it, and Join on the bottom edge where a thumb reaches.
 *
 *        (speaker)
 *        room name
 *    3 people are here
 *  [avatar name] [avatar name] ...
 * [ ........ Join call ........ ]
 */
function Unavailable(props: ChannelPageProps) {
  const { t } = useLingui();
  const ids = () => [...props.channel.voiceParticipants.keys()];
  const users = useUsers(ids);
  const count = () => ids().length;

  return (
    <Lobby>
      <Room>
        <RoomIcon>
          <Icon name="speaker-high" size={34} />
        </RoomIcon>
        <RoomName>{props.channel.name}</RoomName>
        <RoomHint>
          {count() === 0
            ? t`No one is here yet. Start the call and others can join.`
            : count() === 1
              ? t`1 person is here`
              : t`${count()} people are here`}
        </RoomHint>
        <Show when={count()}>
          <People>
            <For each={users()}>
              {(user) => (
                <Person>
                  <Avatar
                    size={48}
                    src={user?.avatar}
                    fallback={user?.username}
                  />
                  <span dir="auto">{user?.username}</span>
                </Person>
              )}
            </For>
          </People>
        </Show>
      </Room>
      <Dock>
        <Unavailable.Action {...props} />
      </Dock>
    </Lobby>
  );
}

/** Join, or why joining is not possible */
Unavailable.Action = function Action(props: ChannelPageProps) {
  const { t } = useLingui();
  const voice = useVoice();

  return (
    <Notice>
      <Switch>
        <Match when={!props.channel.havePermission("Connect")}>
          <Trans>You don't have permission to join.</Trans>
        </Match>
        <Match when={voiceOccupancy(props.channel).full}>
          <Trans>This voice channel is full.</Trans>
        </Match>
        <Match when={voice.error()}>
          <span role="alert">{voice.error()}</span>
          <Retry type="button" onClick={() => voice.connect(props.channel)}>
            <Trans>Try again</Trans>
          </Retry>
        </Match>
        <Match when={true}>
          <JoinRow>
            {/* mute before joining: the choice is kept for the call */}
            <MicToggle
              type="button"
              aria-pressed={!voice.unmuted()}
              aria-label={
                voice.unmuted() ? t`Join muted` : t`Join with microphone on`
              }
              title={
                voice.unmuted() ? t`Join muted` : t`Join with microphone on`
              }
              onClick={() => void voice.toggleMute()}
            >
              <Icon
                name={voice.unmuted() ? "microphone" : "microphone-slash"}
                size={20}
              />
            </MicToggle>
            <Retry
              type="button"
              data-join
              onClick={() => voice.connect(props.channel)}
            >
              <Icon name="phone" size={20} />
              <Trans>Join call</Trans>
            </Retry>
          </JoinRow>
        </Match>
      </Switch>
    </Notice>
  );
};

const Lobby = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
});

const Room = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "32px 16px 16px",
    textAlign: "center",
  },
});

const RoomIcon = styled("div", {
  base: {
    width: "88px",
    height: "88px",
    display: "grid",
    placeItems: "center",
    color: "var(--z-accent)",
    "--z-icon-color": "currentColor",
    marginBottom: "6px",
  },
});

const RoomName = styled("h2", {
  base: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const RoomHint = styled("p", {
  base: {
    margin: 0,
    maxWidth: "320px",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const People = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "16px",
    marginTop: "18px",
    maxWidth: "420px",
  },
});

const Person = styled("div", {
  base: {
    width: "72px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    "& > span": {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

/** bottom edge: the one action of this screen */
const Dock = styled("div", {
  base: {
    flexShrink: 0,
    // #root already stops above the home bar (styles.css)
    padding: "12px 16px 16px",
    "& > div": { padding: 0, flexGrow: 0 },
  },
});

const Stage = styled("div", {
  base: {
    position: "relative",
    flexGrow: 1,
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    background: "var(--z-bg-app)",
  },
});

const Notice = styled("div", {
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "32px 16px",
    textAlign: "center",
    fontSize: "15px",
    color: "var(--z-fg-muted)",
  },
});

const JoinRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
  },
});

/** Microphone on or off before joining; muted shows the danger colour */
const MicToggle = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: "52px",
    height: "52px",
    border: "none",
    borderRadius: "16px",
    cursor: "pointer",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-input)",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&[aria-pressed=true]": {
      color: "var(--z-danger)",
    },
    _phone: { width: "52px", height: "52px" },
  },
});

const Retry = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    "--z-icon-color": "currentColor",
    "&[data-join]": {
      height: "52px",
      width: "min(100%, 360px)",
      fontSize: "16px",
      borderRadius: "16px",
    },
    height: "36px",
    paddingInline: "18px",
    border: "none",
    borderRadius: "var(--borderRadius-full)",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    color: "var(--z-on-accent)",
    background: "var(--z-accent-fill, var(--z-accent))",

    _hover: { background: "var(--z-btn-primary-hover)" },
    "&:active": { boxShadow: "var(--z-btn-pressed)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});
