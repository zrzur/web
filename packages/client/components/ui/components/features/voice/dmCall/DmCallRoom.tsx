import {
  type JSX,
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import {
  RoomContext,
  TrackLoop,
  useEnsureParticipant,
  useIsMuted,
  useIsSpeaking,
  useMediaDeviceSelect,
  useTrackRefContext,
} from "solid-livekit-components";

import { useLingui } from "@lingui/solid/macro";
import { createResizeObserver } from "@solid-primitives/resize-observer";
import type { Channel } from "@zrzur/sdk/solid";
import { Track } from "livekit-client";

import { conversationName } from "@revolt/app/interface/channels/conversationName";
import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "@revolt/app/menus/ContextMenu";
import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useUser } from "@revolt/markdown/users";
import { useModals } from "@revolt/modal";
import { stoatSinkName, useVoice } from "@revolt/rtc";
import { ringState } from "@revolt/rtc/ringing";
import { canShareScreen } from "@revolt/rtc/screenShare";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui/components/design/Avatar";
import { Icon } from "@revolt/ui/icons/Icon";

import { VoiceParticipantContextMenu } from "../VoiceParticipantMenu";
import { ParticipantTile } from "../callCard/ParticipantTile";
import { ControlButton } from "../callCard/VoiceCallCardActions";

import { callStart, useNow } from "./DmCallStage";
import {
  type PhoneCallView,
  STAGE_MIN,
  aloneFaces,
  aloneInCall,
  aloneMembers,
  callDuration,
  clampStageHeight,
  phoneCallView,
  setPhoneCallView,
  setStageFolded,
  setStageHeight,
  stageFolded,
  stageHeight,
  stageHeightAfterKey,
  stageMax,
  waitingMembers,
} from "./dmCallView";

/**
 * The call this device is in, in a direct message or group: the stage above
 * the conversation (desktop and tablet) or the call screen (phone)
 */
export default function DmCallRoom(props: {
  channel: Channel;
  phone: boolean;
}) {
  const voice = useVoice();
  return (
    <RoomContext.Provider value={voice.room}>
      <Show
        when={props.phone}
        fallback={<DesktopStage channel={props.channel} />}
      >
        <PhoneCall channel={props.channel} />
      </Show>
    </RoomContext.Provider>
  );
}

/** Who is rung for this conversation's call right now */
function ringingIds(channel: Channel) {
  const out = ringState().outgoing;
  return out?.channelId === channel.id ? out.ringing : [];
}

/** "Ringing…" while the others are rung, else the call time */
function useCallStatus(channel: () => Channel) {
  const { t } = useLingui();
  const voice = useVoice();
  const now = useNow();
  return () => {
    if (voice.state() === "CONNECTING") return t`Connecting…`;
    if (voice.state() === "RECONNECTING") return t`Reconnecting…`;
    if (ringingIds(channel()).length) return t`Ringing…`;
    const start = callStart(channel());
    return start ? callDuration(now() - start) : "";
  };
}

/* ------------------------------------------------------------------ */
/* desktop and tablet                                                  */
/* ------------------------------------------------------------------ */

function DesktopStage(props: { channel: Channel }) {
  const { t } = useLingui();
  const [viewHeight, setViewHeight] = createSignal(800);
  const [dragHeight, setDragHeight] = createSignal<number>();
  const [fullscreen, setFullscreen] = createSignal(false);
  let stage: HTMLElement | undefined;
  let anchor: HTMLDivElement | undefined;

  // the channel view's height sets the largest stage
  onMount(() => {
    const view = anchor?.parentElement;
    if (!view) return;
    setViewHeight(view.clientHeight);
    createResizeObserver(view, () => setViewHeight(view.clientHeight));
  });

  const onFullscreen = () =>
    setFullscreen(!!stage && document.fullscreenElement === stage);
  document.addEventListener("fullscreenchange", onFullscreen);
  onCleanup(() => {
    document.removeEventListener("fullscreenchange", onFullscreen);
    if (stage && document.fullscreenElement === stage)
      void document.exitFullscreen().catch(() => undefined);
  });

  const height = () =>
    dragHeight() ?? clampStageHeight(stageHeight(), viewHeight());

  const toggleFullscreen = () => {
    if (!stage) return;
    if (document.fullscreenElement === stage)
      void document.exitFullscreen().catch(() => undefined);
    else void stage.requestFullscreen?.().catch(() => undefined);
  };

  // drag the divider: the stage follows the pointer, saved when let go
  let startY = 0,
    startHeight = 0;
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    startY = event.clientY;
    startHeight = height();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setDragHeight(startHeight);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (dragHeight() === undefined) return;
    setDragHeight(
      clampStageHeight(startHeight + event.clientY - startY, viewHeight()),
    );
  };
  const onPointerUp = () => {
    const value = dragHeight();
    if (value === undefined) return;
    setStageHeight(value);
    setDragHeight();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setStageFolded(true);
      return;
    }
    const next = stageHeightAfterKey(height(), event.key, viewHeight());
    if (next === undefined) return;
    event.preventDefault();
    setStageHeight(next);
  };

  return (
    <>
      <div ref={anchor} hidden />
      <Show
        when={!stageFolded()}
        fallback={<FoldedBar channel={props.channel} />}
      >
        <section
          ref={stage}
          class="z-dmcall-stage"
          data-dm-call="stage"
          aria-label={t`Call`}
          style={{ height: `${height()}px` }}
        >
          <Tiles channel={props.channel} />
          <DesktopControls
            channel={props.channel}
            fullscreen={fullscreen()}
            toggleFullscreen={toggleFullscreen}
          />
        </section>
        <div
          class="z-dmcall-divider"
          role="separator"
          aria-orientation="horizontal"
          aria-label={t`Call size`}
          aria-valuemin={STAGE_MIN}
          aria-valuemax={stageMax(viewHeight())}
          aria-valuenow={height()}
          aria-keyshortcuts="ArrowUp ArrowDown Home End Enter"
          tabIndex={0}
          data-dm-call-divider
          data-dragging={dragHeight() !== undefined ? "" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDblClick={() => setStageFolded(true)}
          onKeyDown={onKeyDown}
          use:floating={{
            tooltip: {
              placement: "bottom",
              content: t`Drag to resize. Enter folds the call.`,
            },
          }}
        />
      </Show>
    </>
  );
}

/** The stage folded to one line: who talks, the time, mute, leave, unfold */
function FoldedBar(props: { channel: Channel }) {
  const { t } = useLingui();
  const voice = useVoice();
  const status = useCallStatus(() => props.channel);

  return (
    <div class="z-dmcall-bar" data-dm-call="folded">
      <div class="z-dmcall-bar-faces">
        <TrackLoop
          tracks={() =>
            voice
              .vidTracks()
              .filter((track) => track.source === Track.Source.Camera)
          }
        >
          {() => <PersonTile channel={props.channel} small />}
        </TrackLoop>
      </div>
      <div class="z-dmcall-bar-text">
        <strong>
          <bdi>{conversationName(props.channel)}</bdi>
        </strong>
        <span class="z-dmcall-time">{status()}</span>
      </div>
      <div class="z-dmcall-bar-actions">
        <MicButton size="xs" />
        <ControlButton
          size="xs"
          tone="neutral"
          label={t`Show the call`}
          data-dm-call-unfold
          onClick={() => setStageFolded(false)}
        >
          <Icon name="caret-down" size={18} />
        </ControlButton>
        <HangUp size="xs" />
      </div>
    </div>
  );
}

function DesktopControls(props: {
  channel: Channel;
  fullscreen: boolean;
  toggleFullscreen: () => void;
}) {
  const { t } = useLingui();
  const { limits } = useInstance();

  return (
    <div
      class="z-dmcall-controls"
      data-voice-controls
      data-dm-call-controls
      role="toolbar"
      aria-label={t`Call controls`}
    >
      <span class="z-dmcall-split">
        <MicButton size="sm" />
        <MenuChevron
          label={t`Microphone and speaker`}
          data-dm-call-devices="audio"
          menu={() => (
            <ContextMenu>
              <DeviceList kind="audioinput" />
              <ContextMenuDivider />
              <DeviceList kind="audiooutput" />
            </ContextMenu>
          )}
        />
      </span>
      <Show when={limits().video}>
        <span class="z-dmcall-split">
          <CameraButton size="sm" />
          <MenuChevron
            label={t`Camera`}
            data-dm-call-devices="video"
            menu={() => (
              <ContextMenu>
                <DeviceList kind="videoinput" />
              </ContextMenu>
            )}
          />
        </span>
      </Show>
      <Show when={canShareScreen && limits().video}>
        <ShareButton />
      </Show>
      <MoreButton
        size="sm"
        menu={() => (
          <ContextMenu>
            <DeafenItem />
            <ContextMenuButton
              icon={
                <Icon
                  name={props.fullscreen ? "arrows-in" : "arrows-out"}
                  size={18}
                />
              }
              onClick={props.toggleFullscreen}
              data-dm-call-fullscreen
            >
              {props.fullscreen ? t`Exit full screen` : t`Full screen`}
            </ContextMenuButton>
            <ContextMenuButton
              icon={<Icon name="caret-up" size={18} />}
              onClick={() => setStageFolded(true)}
              data-dm-call-fold
            >
              {t`Fold the call`}
            </ContextMenuButton>
            <ContextMenuDivider />
            <VoiceSettingsItem />
          </ContextMenu>
        )}
      />
      <HangUp size="sm" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* phone                                                               */
/* ------------------------------------------------------------------ */

function PhoneCall(props: { channel: Channel }) {
  const { t } = useLingui();
  const voice = useVoice();
  const { openModal } = useModals();
  const client = useClient();
  const status = useCallStatus(() => props.channel);

  const view = () =>
    phoneCallView(voice.room()) as Exclude<PhoneCallView, "minimised">;
  const show = (next: PhoneCallView) => setPhoneCallView(voice.room(), next);

  // the sheet's handle: a tap or a pull down goes back to the call
  let pullFrom: number | undefined;
  const onHandleDown = (event: PointerEvent) => {
    pullFrom = event.clientY;
  };
  const onHandleMove = (event: PointerEvent) => {
    if (pullFrom !== undefined && event.clientY - pullFrom > 40) {
      pullFrom = undefined;
      show("full");
    }
  };

  return (
    <section
      class="z-dmcall-phone"
      data-dm-call="phone"
      data-view={view()}
      aria-label={t`Call`}
    >
      <div class="z-dmcall-top">
        <button
          type="button"
          aria-label={t`Minimise the call`}
          data-dm-call-minimise
          onClick={() => show("minimised")}
        >
          <Icon name="caret-down" size={24} />
        </button>
        <button
          type="button"
          data-dm-call-title
          aria-label={
            view() === "full" ? t`Open the chat` : t`Back to the call`
          }
          onClick={() => show(view() === "full" ? "chat" : "full")}
        >
          <strong>
            <bdi>{conversationName(props.channel)}</bdi>
          </strong>
          <span class="z-dmcall-time">{status()}</span>
        </button>
        <span
          style={{ display: "contents" }}
          use:floating={{
            contextMenu: () => (
              <ContextMenu>
                <DeviceList kind="audiooutput" />
                <ContextMenuDivider />
                <DeviceList kind="audioinput" />
              </ContextMenu>
            ),
            contextMenuHandler: "click",
          }}
        >
          <button
            type="button"
            aria-label={t`Speaker and microphone`}
            aria-haspopup="menu"
            data-dm-call-devices="audio"
          >
            <Icon name="speaker-high" size={22} />
          </button>
        </span>
        <Show when={props.channel.type === "Group"}>
          <button
            type="button"
            aria-label={t`Add people`}
            data-dm-call-add
            onClick={() =>
              openModal({
                type: "add_members_to_group",
                group: props.channel,
                client: client(),
              })
            }
          >
            <Icon name="user-plus" size={22} />
          </button>
        </Show>
      </div>

      <Tiles channel={props.channel} phone />

      <Switch>
        <Match when={view() === "full"}>
          <div class="z-dmcall-dock">
            <PhoneControls onChat={() => show("chat")} />
          </div>
        </Match>
        <Match when={view() === "chat"}>
          <button
            type="button"
            class="z-dmcall-sheet-top"
            aria-label={t`Back to the call`}
            data-dm-call-sheet-handle
            onClick={() => show("full")}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={() => (pullFrom = undefined)}
          />
        </Match>
      </Switch>
    </section>
  );
}

function PhoneControls(props: { onChat: () => void }) {
  const { t } = useLingui();
  const { limits } = useInstance();

  return (
    <div
      class="z-dmcall-controls"
      data-voice-controls
      data-dm-call-controls
      role="toolbar"
      aria-label={t`Call controls`}
    >
      <Show when={limits().video}>
        <CameraButton size="sm" />
      </Show>
      <MicButton size="sm" />
      <ControlButton
        size="sm"
        tone="neutral"
        label={t`Open the chat`}
        data-dm-call-chat
        onClick={props.onChat}
      >
        <Icon name="chat-circle" size={22} />
      </ControlButton>
      <MoreButton
        size="sm"
        menu={() => (
          <ContextMenu>
            <DeafenItem />
            <Show when={canShareScreen && limits().video}>
              <ShareItem />
            </Show>
            <Show when={limits().video}>
              <ContextMenuDivider />
              <DeviceList kind="videoinput" />
            </Show>
            <ContextMenuDivider />
            <VoiceSettingsItem />
          </ContextMenu>
        )}
      />
      <HangUp size="sm" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* tiles                                                               */
/* ------------------------------------------------------------------ */

/**
 * Everyone in the call (a face, a camera, a shared screen) and the people of
 * the conversation who are not in it yet ("Ringing…" while they are rung)
 */
function Tiles(props: { channel: Channel; phone?: boolean }) {
  const voice = useVoice();
  const client = useClient();

  const tracks = () => voice.vidTracks();
  const waiting = createMemo(() =>
    waitingMembers(
      props.channel.recipientIds,
      tracks().map((track) => track.participant.identity),
      client().user?.id,
      ringingIds(props.channel),
    ).filter(
      // a group shows only who is being rung; a DM always shows the other
      (member) => props.channel.type === "DirectMessage" || member.ringing,
    ),
  );

  const alone = () =>
    aloneInCall(
      voice.state(),
      tracks().map((track) => track.participant.identity),
      client().user?.id,
    );

  return (
    <Show
      // someone to show beside you (the other side of a DM, or whoever is
      // being rung): a tile of their own next to yours, "Ringing…" on it,
      // not a small dimmed face under your tile with its name over yours
      when={!alone() || waiting().length > 0}
      fallback={<AloneView channel={props.channel} tracks={tracks} />}
    >
      <div
        class="z-dmcall-tiles"
        data-many={tracks().length + waiting().length > 2 ? "" : undefined}
      >
        <TrackLoop tracks={tracks}>
          {() => <TrackTile channel={props.channel} />}
        </TrackLoop>
        <For each={waiting()}>
          {(member) => <WaitingTile id={member.id} ringing={member.ringing} />}
        </For>
      </div>
    </Show>
  );
}

/**
 * Connected and nobody else is in the call yet: your own tile large, the
 * other members dimmed under it until they join, and one line saying so
 */
function AloneView(props: {
  channel: Channel;
  tracks: () => ReturnType<ReturnType<typeof useVoice>["vidTracks"]>;
}) {
  const client = useClient();
  const { t } = useLingui();
  const members = createMemo(() =>
    aloneMembers(
      props.channel.recipientIds,
      client().user?.id,
      ringingIds(props.channel),
    ),
  );
  const faces = createMemo(() => aloneFaces(members()));
  const shown = () => faces().shown;
  const more = () => faces().more;
  const calling = () => members().some((member) => member.ringing);

  return (
    <div class="z-dmcall-alone" data-dm-call-alone>
      <div class="z-dmcall-tiles z-dmcall-alone-self">
        <TrackLoop tracks={props.tracks}>
          {() => <TrackTile channel={props.channel} />}
        </TrackLoop>
      </div>
      <Show when={members().length}>
        <ul class="z-dmcall-alone-members" aria-label={t`Members`}>
          <For each={shown()}>
            {(member) => (
              <AloneMember id={member.id} ringing={member.ringing} />
            )}
          </For>
          <Show when={more() > 0}>
            <li class="z-dmcall-alone-more">+{more()}</li>
          </Show>
        </ul>
      </Show>
      {/* wording shared with the phone app (same msgids) */}
      <p class="z-dmcall-alone-line" role="status">
        {t`Only you are here. The others can join while you stay in the call.`}
        <Show when={calling()}>
          <span class="z-dmcall-alone-calling" data-dm-call-calling>
            {t`Calling…`}
          </span>
        </Show>
      </p>
    </div>
  );
}

/** A member who has not joined: dimmed; a soft pulse while being rung */
function AloneMember(props: { id: string; ringing: boolean }) {
  const { t } = useLingui();
  const user = useUser(() => props.id);

  return (
    <li
      class="z-dmcall-tile z-dmcall-alone-member"
      data-waiting
      data-ringing={props.ringing ? "" : undefined}
      data-dm-call-waiting={props.id}
      aria-label={
        props.ringing
          ? t`${user().username as string}, ringing`
          : (user().username as string)
      }
      use:floating={{
        tooltip: { placement: "top", content: user().username as string },
      }}
    >
      <div class="z-dmcall-face">
        <Avatar
          src={user().avatar}
          fallback={user().username}
          size={40}
          interactive={false}
        />
      </div>
    </li>
  );
}

/** A camera or a shared screen uses the call card's tile; a face ours */
function TrackTile(props: { channel: Channel }) {
  const track = useTrackRefContext();
  const participant = useEnsureParticipant();
  const cameraOff = useIsMuted({
    participant,
    source: Track.Source.Camera,
  });

  return (
    <Show
      when={track.source === Track.Source.ScreenShare || !cameraOff()}
      fallback={<PersonTile channel={props.channel} />}
    >
      <ParticipantTile />
    </Show>
  );
}

/** A person in the call without a camera: the avatar and its speaking ring */
function PersonTile(props: { channel: Channel; small?: boolean }) {
  const { t } = useLingui();
  const voice = useVoice();
  const participant = useEnsureParticipant();
  const user = useUser(participant.identity);
  const speaking = useIsSpeaking(participant);
  const muted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });
  const deafened = () =>
    participant.isLocal
      ? voice.deafen()
      : props.channel.voiceParticipants
          .get(participant.identity)
          ?.isReceiving?.() === false;

  return (
    <div
      class="z-dmcall-tile"
      tabIndex={props.small ? -1 : 0}
      data-voice-participant={participant.identity}
      data-speaking={speaking() ? "" : undefined}
      data-muted={muted() ? "" : undefined}
      aria-label={
        speaking()
          ? t`${user().username}, speaking`
          : (user().username as string)
      }
      use:floating={{
        contextMenu: participant.isLocal
          ? undefined
          : () => (
              <Show when={user().user}>
                <VoiceParticipantContextMenu
                  user={user().user!}
                  channel={props.channel}
                />
              </Show>
            ),
      }}
    >
      <div class="z-dmcall-face">
        <Avatar
          src={user().avatar}
          fallback={user().username}
          size={props.small ? 32 : 96}
          interactive={false}
        />
      </div>
      <Show when={!props.small}>
        <div class="z-dmcall-name">
          <bdi>{user().username}</bdi>
          <Show when={muted()}>
            <span data-mark="muted" role="img" aria-label={t`Muted`}>
              <Icon name="microphone-slash" size={16} />
            </span>
          </Show>
          <Show when={deafened()}>
            <span data-mark="deafened" role="img" aria-label={t`Deafened`}>
              <Icon name="headphones-slash" size={16} />
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/** Someone of the conversation who is not in the call */
function WaitingTile(props: { id: string; ringing: boolean }) {
  const { t } = useLingui();
  const user = useUser(() => props.id);

  return (
    <div
      class="z-dmcall-tile"
      data-waiting
      data-ringing={props.ringing ? "" : undefined}
      data-dm-call-waiting={props.id}
    >
      <div class="z-dmcall-face">
        <Avatar
          src={user().avatar}
          fallback={user().username}
          size={96}
          interactive={false}
        />
      </div>
      <div class="z-dmcall-name">
        <bdi>{user().username}</bdi>
      </div>
      <Show when={props.ringing}>
        <span class="z-dmcall-state" role="status">
          {t`Ringing…`}
        </span>
      </Show>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* controls                                                            */
/* ------------------------------------------------------------------ */

type Size = "xs" | "sm";

function MicButton(props: { size: Size }) {
  const { t } = useLingui();
  const voice = useVoice();
  const iconSize = () => (props.size === "xs" ? 18 : 22);

  return (
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
  );
}

function CameraButton(props: { size: Size }) {
  const { t } = useLingui();
  const voice = useVoice();

  return (
    <ControlButton
      size={props.size}
      tone={voice.video() ? "on" : "neutral"}
      data-voice-control="camera"
      aria-pressed={!!voice.video()}
      disabled={
        voice.state() !== "CONNECTED" ||
        (!voice.videoPermission && !voice.video())
      }
      label={voice.video() ? t`Stop camera` : t`Start camera`}
      onClick={() => voice.toggleCamera()}
    >
      <Show
        when={voice.video()}
        fallback={<Icon name="video-camera-slash" size={22} />}
      >
        <Icon name="video-camera" size={22} />
      </Show>
    </ControlButton>
  );
}

function ShareButton() {
  const { t } = useLingui();
  const voice = useVoice();

  return (
    <ControlButton
      size="sm"
      tone={voice.screenshare() ? "on" : "neutral"}
      data-voice-control="screenshare"
      aria-pressed={!!voice.screenshare()}
      disabled={
        voice.state() !== "CONNECTED" ||
        (!voice.videoPermission && !voice.screenshare())
      }
      label={voice.screenshare() ? t`Stop sharing` : t`Share screen`}
      onClick={() => voice.toggleScreenshare()}
    >
      <Icon name="monitor-arrow-up" size={22} />
    </ControlButton>
  );
}

function HangUp(props: { size: Size }) {
  const { t } = useLingui();
  const voice = useVoice();

  return (
    <ControlButton
      size={props.size}
      tone="danger"
      data-voice-control="disconnect"
      label={t`Disconnect`}
      onClick={() => voice.disconnect()}
    >
      <Icon
        name="phone-disconnect"
        size={props.size === "xs" ? 18 : 22}
        filled
      />
    </ControlButton>
  );
}

/** A round control that opens a menu (More) */
function MoreButton(props: { size: Size; menu: () => JSX.Element }) {
  const { t } = useLingui();
  return (
    <span
      style={{ display: "contents" }}
      use:floating={{
        contextMenu: props.menu,
        contextMenuHandler: "click",
      }}
    >
      <ControlButton
        size={props.size}
        tone="neutral"
        label={t`More`}
        aria-haspopup="menu"
        data-dm-call-more
        onClick={() => undefined}
      >
        <Icon name="dots-three" size={22} />
      </ControlButton>
    </span>
  );
}

/** The small arrow beside a control: which device it uses */
function MenuChevron(props: {
  label: string;
  menu: () => JSX.Element;
  [data: `data-${string}`]: unknown;
}) {
  return (
    <span
      style={{ display: "contents" }}
      use:floating={{
        contextMenu: props.menu,
        contextMenuHandler: "click",
        tooltip: { placement: "top", content: props.label },
      }}
    >
      <button
        type="button"
        class="z-dmcall-chevron"
        aria-label={props.label}
        aria-haspopup="menu"
        data-dm-call-devices={props["data-dm-call-devices"] as string}
      >
        <Icon name="caret-up" size={16} />
      </button>
    </span>
  );
}

function DeafenItem() {
  const { t } = useLingui();
  const voice = useVoice();
  return (
    <ContextMenuButton
      icon={
        <Icon
          name={voice.deafen() ? "headphones-slash" : "headphones"}
          size={18}
        />
      }
      onClick={() => voice.toggleDeafen()}
      data-voice-control="deafen"
    >
      {voice.deafen() ? t`Undeafen` : t`Deafen`}
    </ContextMenuButton>
  );
}

function ShareItem() {
  const { t } = useLingui();
  const voice = useVoice();
  return (
    <ContextMenuButton
      icon={<Icon name="monitor-arrow-up" size={18} />}
      onClick={() => voice.toggleScreenshare()}
      data-voice-control="screenshare"
    >
      {voice.screenshare() ? t`Stop sharing` : t`Share screen`}
    </ContextMenuButton>
  );
}

function VoiceSettingsItem() {
  const { t } = useLingui();
  const { openModal } = useModals();
  return (
    <ContextMenuButton
      icon={<Icon name="sliders-horizontal" size={18} />}
      onClick={() =>
        openModal({
          type: "settings",
          config: "user",
          context: { page: "voice" },
        })
      }
      data-dm-call-settings
    >
      {t`Voice settings`}
    </ContextMenuButton>
  );
}

/** One kind of device to pick from, as in voice settings */
function DeviceList(props: { kind: MediaDeviceKind }) {
  const { t } = useLingui();
  const voice = useVoice();
  const state = useState();
  const media = useMediaDeviceSelect({
    // a list is for one kind of device for as long as it is open
    // eslint-disable-next-line solid/reactivity
    kind: props.kind,
    room: voice.room(),
  });

  const key = () =>
    props.kind === "videoinput"
      ? "preferredVideoDevice"
      : props.kind === "audioinput"
        ? "preferredAudioInputDevice"
        : "preferredAudioOutputDevice";

  const title = () =>
    props.kind === "videoinput"
      ? t`Camera`
      : props.kind === "audioinput"
        ? t`Microphone`
        : t`Speaker`;

  const devices = createMemo(() => {
    const list = media
      .devices()
      .filter((device) => device.label.split(":").pop() !== stoatSinkName);
    const ordered: { id: string; label: string }[] = [];
    const fallback = list.find((device) => device.deviceId === "default");
    if (props.kind !== "videoinput" || !list.length)
      ordered.push({ id: "default", label: fallback?.label || t`Default` });
    for (const device of list)
      if (device.deviceId !== "default")
        ordered.push({
          id: device.deviceId,
          label: device.label || device.deviceId,
        });
    return ordered;
  });

  // a camera has no "default" entry: the first one is used until one is picked
  const active = () =>
    state.voice[key()] ??
    (props.kind === "videoinput" ? devices()[0]?.id : "default");

  const choose = (id: string) => {
    if (props.kind !== "videoinput" || id !== "default")
      void media.setActiveMediaDevice(id);
    state.voice[key()] = id === "default" ? undefined : id;
  };

  return (
    // no wrapper around the rows: a phone's menu sheet groups the rows
    // between dividers into one card, as in every other menu
    <>
      <div class="z-dmcall-menu-title" data-dm-call-device-title={props.kind}>
        {title()}
      </div>
      <Show
        when={props.kind !== "audiooutput" || devices().length > 1}
        fallback={
          <div class="z-dmcall-note">
            {t`This browser plays calls on the device's own speaker choice.`}
          </div>
        }
      >
        <For each={devices()}>
          {(device) => (
            <ContextMenuButton
              role="menuitemradio"
              aria-checked={active() === device.id}
              selected={active() === device.id}
              data-device-kind={props.kind}
              actionIcon={
                active() === device.id ? (
                  <Icon name="check" size={16} />
                ) : undefined
              }
              onClick={() => choose(device.id)}
            >
              {device.label}
            </ContextMenuButton>
          )}
        </For>
      </Show>
    </>
  );
}
