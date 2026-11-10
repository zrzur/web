import {
  For,
  Show,
  Suspense,
  createEffect,
  createSignal,
  lazy,
  splitProps,
} from "solid-js";

import { Channel, VoiceParticipant } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useUser } from "@revolt/markdown/users";
import { InRoom } from "@revolt/rtc";
import { voiceModeration } from "@revolt/rtc/moderation";
import {
  VOICE_PARTICIPANT_DRAG_TYPE,
  draggedVoiceParticipant,
  setDraggedVoiceParticipant,
} from "@revolt/rtc/voiceDrag";

import { VoiceParticipantContextMenu } from "./VoiceParticipantMenu";

import { Avatar, Ripple, typography } from "../../design";
import { Row } from "../../layout";

import { VoiceStatefulUserIcons } from "./VoiceStatefulUserIcons";

/**
 * Render a preview of users (or the active participants) for a given channel
 *
 * Designed for the server sidebar to be below channels
 */
export function VoiceChannelPreview(props: { channel: Channel }) {
  return (
    <InRoom
      channelId={props.channel.id}
      fallback={<VariantPreview channel={props.channel} />}
    >
      <Suspense fallback={<VariantPreview channel={props.channel} />}>
        <VariantLive channel={props.channel} />
      </Suspense>
    </InRoom>
  );
}

/** Who is in the call per LiveKit, loaded with it (the first call) */
const VariantLive = lazy(() => import("./LiveVoiceChannelPreview"));

/** A still of a screen share, loaded the first time someone hovers one */
const StreamPreviewCard = lazy(() => import("./StreamPreviewCard"));

/**
 * Use the API as the source of truth
 */
function VariantPreview(props: { channel: Channel }) {
  return (
    <Show when={props.channel.voiceParticipants.size}>
      <Base>
        <For each={[...props.channel.voiceParticipants.values()]}>
          {(participant) => (
            <ParticipantPreview
              channel={props.channel}
              participant={participant}
            />
          )}
        </For>
      </Base>
    </Show>
  );
}

/**
 * Preview variant of participant
 */
function ParticipantPreview(props: {
  participant: VoiceParticipant;
  channel: Channel;
}) {
  return (
    <CommonUser
      channel={props.channel}
      userId={props.participant.userId}
      speaking={false}
      muted={!props.participant.isPublishing()}
      deafened={!props.participant.isReceiving()}
      camera={props.participant.isCamera()}
      screenshare={props.participant.isScreensharing()}
    />
  );
}

/**
 * Component used for both variants
 */
export function CommonUser(props: {
  channel: Channel;
  userId: string;
  speaking: boolean;
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  screenshare: boolean;
  isLive?: boolean;
}) {
  const [iconProps, rest] = splitProps(props, [
    "muted",
    "deafened",
    "camera",
    "screenshare",
  ]);

  const user = useUser(() => rest.userId);
  const client = useClient();
  const member = () =>
    rest.channel.serverId
      ? client().serverMembers.getByKey({
          server: rest.channel.serverId,
          user: rest.userId,
        })
      : undefined;
  createEffect(() => {
    if (rest.channel.serverId)
      void client()
        .serverMembers.fetch(rest.channel.serverId, rest.userId)
        .catch(() => undefined);
  });

  // Before joining, hovering (or focusing) someone who shares their screen
  // shows a still of it; nothing is fetched until then
  const [hovered, setHovered] = createSignal(false);
  const showPreview = () =>
    hovered() &&
    iconProps.screenshare &&
    !rest.isLive &&
    !draggedVoiceParticipant();

  // Moderators drag participants onto another voice channel (Discord-style).
  const canDrag = () => voiceModeration(rest.channel, member()).move;
  // Channel reordering grabs rows on mousedown/touchstart; a participant
  // drag must not start a channel drag as well. Native listeners, since
  // delegated handlers run after the reorder zone has seen the event.
  const keepFromChannelDrag = (event: Event) => {
    if (canDrag()) event.stopPropagation();
  };

  return (
    <div
      class={previewUser({ speaking: rest.speaking })}
      tabIndex={0}
      data-voice-participant={rest.userId}
      data-dragging={
        draggedVoiceParticipant()?.userId === rest.userId ? "" : undefined
      }
      aria-label={member()?.displayName ?? user().username}
      draggable={canDrag()}
      on:mousedown={keepFromChannelDrag}
      on:touchstart={keepFromChannelDrag}
      on:dragstart={(event: DragEvent) => {
        if (!canDrag() || !event.dataTransfer) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(VOICE_PARTICIPANT_DRAG_TYPE, rest.userId);
        setDraggedVoiceParticipant({
          userId: rest.userId,
          channelId: rest.channel.id,
        });
      }}
      on:dragend={() => setDraggedVoiceParticipant()}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      use:floating={{
        userCard: {
          user: user().user!,
          member: member(),
        },
        contextMenu: () => (
          <Show when={user().user}>
            {(resolvedUser) => (
              <VoiceParticipantContextMenu
                channel={rest.channel}
                user={resolvedUser()}
              />
            )}
          </Show>
        ),
      }}
    >
      <Ripple />
      <Show when={showPreview()}>
        <StreamPreviewCard
          channel={rest.channel}
          userId={rest.userId}
          name={member()?.displayName ?? user().username}
        />
      </Show>
      <Avatar size={24} src={user().avatar} fallback={user().username} />{" "}
      <PreviewUsername>
        {member()?.displayName ?? user().username}
      </PreviewUsername>
      <Row gap="sm">
        <VoiceStatefulUserIcons
          {...iconProps}
          userId={rest.userId}
          serverMuted={member()?.canPublish === false}
          serverDeafened={member()?.canReceive === false}
        />
      </Row>
    </div>
  );
}

export const Base = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",

    marginBlock: "var(--gap-sm)",
    marginInlineStart: "var(--gap-xl)",
    marginInlineEnd: "var(--gap-md)",

    color: "var(--md-sys-color-outline)",

    borderRadius: "var(--borderRadius-md)",
  },
});

const previewUser = cva({
  base: {
    padding: "var(--gap-sm)",
    position: "relative", // ... <Ripple />
    display: "flex",
    gap: "var(--gap-md)",
    alignItems: "center",
    minWidth: 0,
    minHeight: "34px",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: { outline: "1px solid var(--z-focus)" },
    borderRadius: "var(--borderRadius-md)",
    "&[draggable='true']": { cursor: "grab" },
    "&[data-dragging]": { opacity: 0.5 },
  },
  variants: {
    speaking: {
      true: {
        color: "var(--md-sys-color-on-surface)",

        "& svg": {
          outlineOffset: "1px",
          outline: "2px solid var(--md-sys-color-primary)",
          borderRadius: "var(--borderRadius-circle)",
        },
      },
    },
  },
});

const PreviewUsername = styled("span", {
  base: {
    ...typography.raw(),

    flexGrow: 1,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});
