import { For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useUsers } from "@revolt/markdown/users";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { voiceOccupancy } from "@revolt/rtc/moderation";
import { useState } from "@revolt/state";
import { Avatar, Dialog, DialogProps } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

/**
 * Phones: a voice room, before joining. A sheet over the channel list: who
 * is in the room, the microphone on or off, and Join. A press on a room used
 * to join at once and leave the list (owner, 2026-11-17).
 *
 *  Lounge
 *  3 people are here
 *  (o) Omar  (o) Sara  (o) Yazan
 *  [mic]  Join with microphone on
 *  [ Join call ]
 */
export function VoiceRoomModal(
  props: DialogProps & Modals & { type: "voice_room" },
) {
  const { t } = useLingui();
  const voice = useVoice();
  const state = useState();
  const navigate = useNavigate();

  // The saved choice, not the call's "unmuted": that one asks the call the
  // person is in for the right to speak, and before joining there is none, so
  // the row always read "muted" and a press changed nothing (owner, 2026-11-18)
  const micOn = () => state.voice.micOn && !state.voice.deafen;

  const ids = () => [...props.channel.voiceParticipants.keys()];
  const users = useUsers(ids);
  const count = () => ids().length;

  const refused = () =>
    !props.channel.havePermission("Connect")
      ? t`You don't have permission to join.`
      : voiceOccupancy(props.channel).full
        ? t`This voice channel is full.`
        : undefined;

  const join = () => {
    navigate(`/server/${props.channel.serverId}/channel/${props.channel.id}`);
    // the call is a whole page: bring it on screen
    state.appDrawer()?.setShown(true);
    void voice.connect(props.channel);
  };

  return (
    <Dialog
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={<span dir="auto">{props.channel.name}</span>}
      description={
        refused() ??
        (count() === 0
          ? t`No one is here yet. Start the call and others can join.`
          : count() === 1
            ? t`1 person is here`
            : t`${count()} people are here`)
      }
      actions={
        refused()
          ? [{ text: <Trans>Close</Trans> }]
          : [{ text: <Trans>Join call</Trans>, onClick: join }]
      }
    >
      <Body data-voice-room-sheet>
        <Show when={count()}>
          <People>
            <For each={users().slice(0, 8)}>
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
        <Show when={!refused()}>
          {/* mute before joining: the choice is kept for the call */}
          <Mic
            type="button"
            aria-pressed={!micOn()}
            onClick={() => void voice.toggleMute()}
          >
            <MicIcon>
              <Icon
                name={micOn() ? "microphone" : "microphone-slash"}
                size={22}
              />
            </MicIcon>
            <span>
              <Show when={micOn()} fallback={<Trans>Join muted</Trans>}>
                <Trans>Join with microphone on</Trans>
              </Show>
            </span>
          </Mic>
        </Show>
      </Body>
    </Dialog>
  );
}

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
});

const People = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
});

const Person = styled("div", {
  base: {
    width: "64px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--z-fg-secondary)",
    "& > span": {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Mic = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minHeight: "56px",
    padding: "6px 14px 6px 6px",
    paddingInline: "6px 14px",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    font: "inherit",
    fontSize: "15px",
    fontWeight: 500,
    textAlign: "start",
    color: "var(--z-fg-primary)",
    background:
      "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
    "--z-icon-color": "currentColor",
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    // muted: the tint the call's own controls use for "off"
    "&[aria-pressed='true'] > span:first-child": {
      color: "var(--z-danger)",
      background: "var(--z-danger-muted)",
    },
  },
});

const MicIcon = styled("span", {
  base: {
    flex: "none",
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    borderRadius: "12px",
    background: "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
  },
});
