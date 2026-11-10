import { For, Match, Show, Switch, createEffect, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useUsers } from "@revolt/markdown/users";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { voiceOccupancy } from "@revolt/rtc/moderation";
import { Avatar, Header } from "@revolt/ui";
import { VoiceChannelCallCardMount } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";
import { Icon } from "@revolt/ui/icons/Icon";

import { ChannelHeader } from "../ChannelHeader";
import { ChannelPageProps } from "../ChannelPage";

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

  return (
    <>
      <Header placement="primary">
        <ChannelHeader channel={props.channel} />
      </Header>
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
