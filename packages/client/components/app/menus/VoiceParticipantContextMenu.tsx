import { Trans, useLingui } from "@lingui/solid/macro";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useVoice } from "@revolt/rtc";
import { useVoiceError } from "@revolt/rtc/messages";
import {
  voiceDestinations,
  voiceModeration,
  voiceOccupancy,
} from "@revolt/rtc/moderation";
import { useState } from "@revolt/state";
import { dismissFloatingElements } from "@revolt/ui/components/floating";
import { Icon } from "@revolt/ui/icons/Icon";
import { useNavigate } from "@solidjs/router";
import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { Channel, ServerMember, User } from "@zrzur/sdk/solid";
import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "./ContextMenu";
import "./voice-menu.css";

type Action =
  | { kind: "mute" | "deafen"; value: boolean }
  | { kind: "disconnect" }
  | { kind: "move"; to: string };

/** Uses the shared floating menu; the backend event, not the PATCH response, confirms success. */
export function VoiceParticipantContextMenu(props: {
  channel: Channel;
  user: User;
  onClose?: () => void;
  /** Opened on this person's stream: the volume controls are for its sound */
  stream?: boolean;
}) {
  const client = useClient();
  const state = useState();
  const voice = useVoice();
  const { openModal } = useModals();
  const navigate = useNavigate();
  const { t } = useLingui();
  const errorMessage = useVoiceError();
  const [pending, setPending] = createSignal<Action>();
  const [status, setStatus] = createSignal("");
  const [failed, setFailed] = createSignal(false);
  const [moving, setMoving] = createSignal(false);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timeout));

  const member = () =>
    props.channel.serverId
      ? client().serverMembers.getByKey({
          server: props.channel.serverId,
          user: props.user.id,
        })
      : undefined;
  createEffect(() => {
    const serverId = props.channel.serverId;
    if (!serverId) return;
    for (const userId of new Set([props.user.id, client().user!.id])) {
      void client()
        .serverMembers.fetch(serverId, userId)
        .catch((error) => {
          setFailed(true);
          setStatus(errorMessage(error));
        });
    }
  });
  const permissions = () => voiceModeration(props.channel, member());
  const destinations = () => voiceDestinations(props.channel, member());
  const busy = () => !!pending();

  createEffect(() => {
    const action = pending();
    const target = member();
    if (!action) return;
    const confirmed =
      action.kind === "mute"
        ? target?.canPublish === action.value
        : action.kind === "deafen"
          ? target?.canReceive === action.value
          : action.kind === "move"
            ? !!client()
                .channels.get(action.to)
                ?.voiceParticipants.has(props.user.id)
            : !props.channel.voiceParticipants.has(props.user.id);
    if (confirmed) {
      clearTimeout(timeout);
      setPending();
      setStatus(t`Voice state updated.`);
    }
  });

  async function perform(action: Action) {
    if (busy()) return;
    const target: ServerMember | undefined = member();
    if (!target) return;
    setFailed(false);
    setStatus(t`Applying…`);
    setPending(action);
    timeout = setTimeout(() => {
      setPending();
      setFailed(true);
      setStatus(
        t`The server has not confirmed the voice change. Check the participant state before retrying.`,
      );
    }, 10000);
    try {
      await target.edit(
        action.kind === "mute"
          ? { can_publish: action.value }
          : action.kind === "deafen"
            ? { can_receive: action.value }
            : action.kind === "move"
              ? { voice_channel: action.to }
              : { remove: ["VoiceChannel"] },
      );
      if (pending()) setStatus(t`Waiting for voice state…`);
    } catch (error) {
      clearTimeout(timeout);
      setPending();
      setFailed(true);
      setStatus(errorMessage(error));
    }
  }

  return (
    <ContextMenu
      class="z-voice-menu"
      data-persistent-context-menu
      aria-label={t`Voice participant actions`}
      onclick={(event) => event.stopPropagation()}
    >
      <div class="z-voice-menu-heading">
        {member()?.displayName ?? props.user.displayName}
      </div>
      <ContextMenuButton
        icon={<Icon name="user-circle" />}
        onClick={() => {
          openModal({ type: "user_profile", user: props.user });
          (props.onClose ?? dismissFloatingElements)();
        }}
      >
        <Trans>View profile</Trans>
      </ContextMenuButton>
      <Show when={!props.user.self}>
        <ContextMenuButton
          icon={<Icon name="chat-circle" />}
          onClick={() => {
            const close = props.onClose ?? dismissFloatingElements;
            void props.user
              .openDM()
              .then((channel) => {
                navigate(channel.path);
                close?.();
              })
              .catch((error) => {
                setFailed(true);
                setStatus(errorMessage(error));
              });
          }}
        >
          <Trans>Send message</Trans>
        </ContextMenuButton>
        <ContextMenuDivider />
        <Show
          when={props.stream}
          fallback={
            <>
              <label class="z-voice-volume">
                <span>
                  <Trans>Local volume</Trans>{" "}
                  <output>
                    {Math.round(state.voice.getUserVolume(props.user.id) * 100)}
                    %
                  </output>
                </span>
                <input
                  aria-label={t`Local volume`}
                  type="range"
                  min="0"
                  max="3"
                  step="0.05"
                  value={state.voice.getUserVolume(props.user.id)}
                  onInput={(event) =>
                    state.voice.setUserVolume(
                      props.user.id,
                      event.currentTarget.valueAsNumber,
                    )
                  }
                />
              </label>
              <ContextMenuButton
                /* icons in this menu show what the action does */
                icon={
                  <Icon
                    name={
                      state.voice.getUserMuted(props.user.id)
                        ? "speaker-high"
                        : "speaker-slash"
                    }
                  />
                }
                onClick={() =>
                  state.voice.setUserMuted(
                    props.user.id,
                    !state.voice.getUserMuted(props.user.id),
                  )
                }
              >
                {state.voice.getUserMuted(props.user.id)
                  ? t`Unmute for me`
                  : t`Mute for me`}
              </ContextMenuButton>
            </>
          }
        >
          <label class="z-voice-volume">
            <span>
              <Trans>Stream volume</Trans>{" "}
              <output>
                {Math.round(
                  state.voice.getScreenShareVolume(props.user.id) * 100,
                )}
                %
              </output>
            </span>
            <input
              aria-label={t`Stream volume`}
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={state.voice.getScreenShareVolume(props.user.id)}
              onInput={(event) =>
                state.voice.setScreenShareVolume(
                  props.user.id,
                  event.currentTarget.valueAsNumber,
                )
              }
            />
          </label>
          <ContextMenuButton
            icon={
              <Icon
                name={
                  state.voice.getScreenShareMuted(props.user.id)
                    ? "speaker-high"
                    : "speaker-slash"
                }
              />
            }
            onClick={() =>
              state.voice.setScreenShareMuted(
                props.user.id,
                !state.voice.getScreenShareMuted(props.user.id),
              )
            }
          >
            {state.voice.getScreenShareMuted(props.user.id)
              ? t`Unmute stream sound`
              : t`Mute stream sound`}
          </ContextMenuButton>
        </Show>
      </Show>
      <Show when={props.user.self && voice.channel()?.id === props.channel.id}>
        <ContextMenuButton
          icon={
            <Icon name={voice.unmuted() ? "microphone-slash" : "microphone"} />
          }
          onClick={() => void voice.toggleMute()}
        >
          {voice.unmuted() ? t`Mute microphone` : t`Unmute microphone`}
        </ContextMenuButton>
        <ContextMenuButton
          icon={
            <Icon name={voice.deafen() ? "headphones" : "headphones-slash"} />
          }
          onClick={() => void voice.toggleDeafen()}
        >
          {voice.deafen() ? t`Undeafen myself` : t`Deafen myself`}
        </ContextMenuButton>
        <ContextMenuButton
          destructive
          icon={<Icon name="phone-disconnect" />}
          onClick={() => voice.disconnect()}
        >
          <Trans>Leave voice</Trans>
        </ContextMenuButton>
      </Show>
      <Show
        when={permissions().mute || permissions().deafen || permissions().move}
      >
        <ContextMenuDivider />
        <div class="z-voice-menu-heading">
          <Trans>Voice moderation</Trans>
        </div>
        <Show when={permissions().mute}>
          <ContextMenuButton
            data-voice-action="mute"
            aria-disabled={busy()}
            icon={
              <Icon
                name={
                  member()?.canPublish === false
                    ? "microphone"
                    : "microphone-slash"
                }
              />
            }
            onClick={() =>
              void perform({
                kind: "mute",
                value: member()?.canPublish === false,
              })
            }
          >
            {member()?.canPublish === false
              ? t`Remove server mute`
              : t`Server mute`}
          </ContextMenuButton>
        </Show>
        <Show when={permissions().deafen}>
          <ContextMenuButton
            data-voice-action="deafen"
            aria-disabled={busy()}
            icon={
              <Icon
                name={
                  member()?.canReceive === false
                    ? "headphones"
                    : "headphones-slash"
                }
              />
            }
            onClick={() =>
              void perform({
                kind: "deafen",
                value: member()?.canReceive === false,
              })
            }
          >
            {member()?.canReceive === false
              ? t`Remove server deafen`
              : t`Server deafen`}
          </ContextMenuButton>
        </Show>
        <Show when={permissions().move}>
          <ContextMenuButton
            data-voice-action="move"
            aria-disabled={busy()}
            icon={<Icon name="arrow-right" />}
            onClick={() => !busy() && setMoving(!moving())}
            aria-expanded={moving()}
          >
            <Trans>Move to voice channel</Trans>
          </ContextMenuButton>
          <Show when={moving()}>
            <div
              class="z-voice-destinations"
              role="group"
              aria-label={t`Destination voice channel`}
            >
              <For
                each={destinations()}
                fallback={
                  <p>
                    <Trans>No accessible voice channels</Trans>
                  </p>
                }
              >
                {(channel) => (
                  <ContextMenuButton
                    data-voice-destination={channel.id}
                    aria-disabled={busy()}
                    icon={<Icon name="speaker-high" size={16} />}
                    onClick={() =>
                      void perform({ kind: "move", to: channel.id })
                    }
                  >
                    {channel.name} · {voiceOccupancy(channel).count}
                    {channel.voice?.maxUsers
                      ? ` / ${channel.voice.maxUsers}`
                      : ""}
                  </ContextMenuButton>
                )}
              </For>
            </div>
          </Show>
          <ContextMenuButton
            destructive
            data-voice-action="disconnect"
            aria-disabled={busy()}
            icon={<Icon name="phone-disconnect" />}
            onClick={() => void perform({ kind: "disconnect" })}
          >
            <Trans>Disconnect from voice</Trans>
          </ContextMenuButton>
        </Show>
      </Show>
      <Show when={status()}>
        <p
          class="z-voice-feedback"
          role={failed() ? "alert" : "status"}
          aria-live="polite"
        >
          {status()}
        </p>
      </Show>
    </ContextMenu>
  );
}
