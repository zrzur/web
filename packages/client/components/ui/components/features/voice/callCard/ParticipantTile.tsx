import { useSpeaking } from "@revolt/rtc/speaking";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import {
  TrackReference,
  useEnsureParticipant,
  useIsMuted,
  useTrackRefContext,
  VideoTrack,
} from "solid-livekit-components";

import { useLingui } from "@lingui/solid/macro";
import { LocalVideoTrack, Track } from "livekit-client";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  holdsRemoteVideo,
  markLoadedByTap,
  saveData,
  wasLoadedByTap,
} from "@revolt/common/lib/saveData";
import { useUser } from "@revolt/markdown/users";
import {
  liveStatsLabel,
  ScreenShareLiveStats,
  senderLiveStats,
  useVoice,
} from "@revolt/rtc";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui/components/design";
import { Row } from "@revolt/ui/components/layout";
import { OverflowingText } from "@revolt/ui/components/utils";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type ConnectionQualityName,
  qualityLevel,
} from "@revolt/rtc/callHealth";

import { VoiceParticipantContextMenu } from "../VoiceParticipantMenu";
import { VoiceStatefulUserIcons } from "../VoiceStatefulUserIcons";
import { keepVideoPlaying } from "./keepVideoPlaying";

type TileProps = {
  focus?: boolean;
};

/**
 * Individual participant tile
 */
export function ParticipantTile(props: TileProps) {
  const voice = useVoice();
  const state = useState();
  const client = useClient();
  const participant = useEnsureParticipant();
  const track = useTrackRefContext();
  const user = useUser(participant.identity);
  const member = () =>
    voice.channel()?.serverId
      ? client().serverMembers.getByKey({
          server: voice.channel()!.serverId!,
          user: participant.identity,
        })
      : undefined;

  let videoRef: HTMLVideoElement | undefined;

  // connection quality as LiveKit measures it; the tile only points out a
  // weak or lost connection, so a good call stays uncluttered
  const [quality, setQuality] = createSignal<ConnectionQualityName>(
    participant.connectionQuality as ConnectionQualityName,
  );
  const onQuality = (next: unknown) =>
    setQuality(next as ConnectionQualityName);
  participant.on("connectionQualityChanged", onQuality);
  onCleanup(() => participant.off("connectionQualityChanged", onQuality));

  const [videoDims, setVideoDims] = createSignal<{
    height: number;
    width: number;
  }>({ height: 0, width: 0 });

  const isMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });

  const isScreenShareAudioMuted = useIsMuted({
    participant,
    source: Track.Source.ScreenShareAudio,
  });

  const isRemoteScreenShareMuted = useIsMuted({
    participant,
    source: Track.Source.ScreenShare,
  });

  const isScreenShareAudioUserMuted = () =>
    !user().user!.self && state.voice.getScreenShareMuted(user().user!.id)
      ? "by-user"
      : isScreenShareAudioMuted() || false;

  const isVideoMuted = useIsMuted({
    participant,
    source: Track.Source.Camera,
  });

  const isVideo = () => !isVideoMuted();
  const isScreenShare = () => track.source === Track.Source.ScreenShare;
  const isSpeaking = useSpeaking(participant);
  const { t } = useLingui();

  // What the stream really is right now (not the quality that was picked):
  // the sender sees its encoder's output, viewers the frames they decode
  const [live, setLive] = createSignal<ScreenShareLiveStats>();
  createEffect(() => {
    if (!isScreenShare() || isRemoteScreenShareMuted()) return setLive();
    let frames: { count: number; at: number } | undefined;
    const sample = async () => {
      if (participant.isLocal) {
        const localTrack = track.publication?.track;
        setLive(
          localTrack instanceof LocalVideoTrack
            ? await senderLiveStats(localTrack).catch(() => undefined)
            : undefined,
        );
        return;
      }
      if (!videoRef?.videoWidth) return setLive();
      const count = videoRef.getVideoPlaybackQuality().totalVideoFrames;
      const at = performance.now();
      const fps = frames
        ? Math.round(((count - frames.count) * 1000) / (at - frames.at))
        : 0;
      frames = { count, at };
      setLive({
        width: videoRef.videoWidth,
        height: videoRef.videoHeight,
        fps,
      });
    };
    const timer = setInterval(sample, 2000);
    void sample();
    onCleanup(() => clearInterval(timer));
  });

  // Save data: someone else's camera or screen is received only after a
  // tap on its tile (nothing of it is subscribed before). Your own picture
  // costs no download and shows as always.
  const watchKey = () => `call:${participant.identity}:${track.source}`;
  const heldVideo = () =>
    !participant.isLocal &&
    (isVideo() || isScreenShare()) &&
    holdsRemoteVideo(saveData()) &&
    !wasLoadedByTap(watchKey());

  const getHeight = () => {
    if (!props.focus || videoDims().height == 0) return {};
    // Calculate the aspect ratio
    const ratio = videoDims().width / videoDims().height;

    return ratio > 1
      ? { height: `min(var(--vc-w) / ${ratio}, 100%)` }
      : { height: "100%" };
  };

  return (
    <Show when={!isScreenShare() || !isRemoteScreenShareMuted()}>
      <div
        class={
          tile({
            speaking: !isScreenShare() && isSpeaking(),
            video: isVideo() || isScreenShare(),
            fullscreen: voice.layout() === "fullscreen",
            ...props,
          }) + (isScreenShare() ? " vc_tile group" : " vc_tile")
        }
        onClick={() => voice.toggleFocus(track)}
        tabIndex={0}
        data-voice-participant={participant.identity}
        // Shift+click mentions the person in the message box (Ctrl+/)
        data-mention-user={participant.identity}
        aria-label={member()?.displayName ?? user().username}
        use:floating={{
          // TODO: Conflicts with focusing, maybe only show if clicking name itself
          //   userCard: {
          //     user: user().user!,
          //     member: user().member,
          //   },
          contextMenu: () => (
            <Show when={user().user && voice.channel()}>
              <VoiceParticipantContextMenu
                user={user().user!}
                channel={voice.channel()!}
                stream={isScreenShare()}
              />
            </Show>
          ),
        }}
        style={{
          ...getHeight(),
          // a steady colour of their own for each person (phone call screen)
          "--vc-tile-hue": tileHue(participant.identity),
        }}
      >
        <Show
          when={(isVideo() || isScreenShare()) && !heldVideo()}
          fallback={
            <Show
              when={heldVideo()}
              fallback={
                <AvatarOnly>
                  <Avatar
                    src={user().avatar}
                    fallback={user().username}
                    size={48}
                    interactive={false}
                  />
                </AvatarOnly>
              }
            >
              <HeldVideo>
                <WatchButton
                  type="button"
                  data-watch-video={isScreenShare() ? "screen" : "camera"}
                  onClick={(event) => {
                    event.stopPropagation();
                    markLoadedByTap(watchKey());
                  }}
                >
                  <Icon
                    size={20}
                    name={isScreenShare() ? "monitor-arrow-up" : "video-camera"}
                  />
                  <span>
                    {isScreenShare() ? t`Show screen` : t`Show camera`}
                  </span>
                </WatchButton>
              </HeldVideo>
            </Show>
          }
        >
          <VideoTrack
            style={{
              "grid-area": "1/1",
              "object-fit": "contain",
              width: "100%",
              height: "100%",
              overflow: "hidden",
            }}
            trackRef={track as TrackReference}
            manageSubscription={true}
            ref={(element: HTMLVideoElement) => {
              videoRef = element;
              // iPhones may refuse to start it: the tile stayed empty
              onCleanup(keepVideoPlaying(element));
            }}
            on:resize={() => {
              setVideoDims({
                height: videoRef?.videoHeight || 0,
                width: videoRef?.videoWidth || 0,
              });
            }}
          />
        </Show>
        <Overlay showOnHover={isScreenShare()}>
          <OverlayInner>
            <OverflowingText>
              {member()?.displayName ?? user().username}
            </OverflowingText>
            <Row gap="md">
              <Show when={!isScreenShare() && qualityLevel(quality()).warn}>
                <WeakConnection
                  role="img"
                  data-connection-quality={quality()}
                  aria-label={
                    quality() === "lost"
                      ? t`Connection lost`
                      : t`Weak connection`
                  }
                  title={
                    quality() === "lost"
                      ? t`Connection lost`
                      : t`Weak connection`
                  }
                >
                  <Icon
                    size={16}
                    name={quality() === "lost" ? "wifi-slash" : "warning"}
                  />
                </WeakConnection>
              </Show>
              <Show when={live()}>
                {(stats) => (
                  <LiveQuality
                    data-screenshare-quality={liveStatsLabel(stats())}
                    limited={!!stats().limitation}
                  >
                    {liveStatsLabel(stats())}
                    <Show when={stats().limitation}>
                      {" · "}
                      {stats().limitation === "cpu"
                        ? t`Limited by CPU`
                        : t`Limited by network`}
                    </Show>
                  </LiveQuality>
                )}
              </Show>
              {isScreenShare() ? (
                <Show when={!participant.isLocal && !isScreenShareAudioMuted()}>
                  {/* the stream's sound (game audio): on by default */}
                  <StreamSoundButton
                    type="button"
                    data-stream-sound={
                      isScreenShareAudioUserMuted() ? "off" : "on"
                    }
                    aria-pressed={!!isScreenShareAudioUserMuted()}
                    aria-label={
                      isScreenShareAudioUserMuted()
                        ? t`Unmute stream sound`
                        : t`Mute stream sound`
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      state.voice.setScreenShareMuted(
                        participant.identity,
                        !state.voice.getScreenShareMuted(participant.identity),
                      );
                    }}
                  >
                    <Icon
                      size={18}
                      name={
                        isScreenShareAudioUserMuted()
                          ? "speaker-slash"
                          : "speaker-high"
                      }
                    />
                  </StreamSoundButton>
                </Show>
              ) : (
                <VoiceStatefulUserIcons
                  userId={participant.identity}
                  muted={isMuted()}
                  camera={isVideo()}
                  serverMuted={member()?.canPublish === false}
                  serverDeafened={member()?.canReceive === false}
                  screenshare={participant.isScreenShareEnabled}
                />
              )}
            </Row>
          </OverlayInner>
        </Overlay>
      </div>
    </Show>
  );
}

/**
 * A hue from an id: the same person always gets the same tint. Kept between
 * teal and magenta (180 to 359): dark yellows and greens look muddy.
 */
function tileHue(id: string) {
  let sum = 0;
  for (let index = 0; index < id.length; index++)
    sum = (sum * 31 + id.charCodeAt(index)) % 360;
  return String(180 + (sum % 180));
}

export const tile = cva({
  base: {
    display: "grid",
    aspectRatio: "16/9",
    // only what is cheap to animate (all properties made every resize
    // and layout change of a call animate)
    transition:
      "opacity .3s ease, transform .3s ease, border-color .3s ease, box-shadow .3s ease",
    borderRadius: "var(--borderRadius-lg)",
    width: "var(--vc-tile-width)",
    maxWidth: "calc(var(--vc-h) * 16 / 9)",
    cursor: "pointer",

    color: "var(--z-fg-primary)",
    // same surface as the channel list beside the call (owner, 2026-11-09)
    background: "var(--z-bg-nav, var(--z-bg-sidebar))",
    border: "1px solid var(--z-border-subtle)",

    overflow: "hidden",
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineOffset: "-2px",
    outlineColor: "transparent",

    _hover: {
      borderColor: "var(--z-border-strong)",
    },
    _focusVisible: {
      outlineColor: "var(--z-focus)",
    },
  },
  variants: {
    speaking: {
      true: {
        outlineColor: "var(--z-presence-online)",
        boxShadow:
          "0 0 0 3px color-mix(in srgb, var(--z-presence-online) 25%, transparent)",
      },
    },
    focus: {
      true: {
        width: "auto",
        maxWidth: "none",
      },
    },
    video: {
      true: {},
    },
    fullscreen: {
      true: {
        minWidth: "20%",
      },
    },
  },
  compoundVariants: [
    {
      video: [false],
      focus: [true],
      css: {
        height: "100%",
        maxHeight: "calc(var(--vc-w) * 9 / 16)",
      },
    },
    {
      video: [true],
      focus: [true],
      css: {
        aspectRatio: "auto",
      },
    },
  ],
});

/** Save data: where a camera or screen would be, until it is asked for */
const HeldVideo = styled("div", {
  base: {
    gridArea: "1/1",
    display: "grid",
    placeItems: "center",
    padding: "12px",
    minWidth: 0,
    overflow: "hidden",
  },
});

const WatchButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "44px",
    maxWidth: "100%",
    padding: "8px 16px",
    cursor: "pointer",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-raised)",
    border: "1px solid var(--z-border-strong)",
    borderRadius: "999px",
    "& span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "&:hover": { background: "var(--z-hover)" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const AvatarOnly = styled("div", {
  base: {
    gridArea: "1/1",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",

    // TODO: Refactor the avatar component to be reactive later.
    "& > *": {
      width: "auto !important",
      height: "min(30%, 112px) !important",
      minHeight: "48px",
    },
  },
});

const Overlay = styled("div", {
  base: {
    minWidth: 0,
    gridArea: "1/1",

    padding: "10px",

    opacity: 1,
    display: "flex",
    alignItems: "end",
    flexDirection: "row",
    pointerEvents: "none",

    transition: "var(--transitions-fast) all",
    transitionTimingFunction: "ease",
  },
  variants: {
    showOnHover: {
      true: {
        opacity: 0,

        _groupHover: {
          opacity: 1,
        },
        // keyboard users reach the stream controls too
        _groupFocusWithin: {
          opacity: 1,
        },
        // a phone has no hover: the name and controls stay visible there
        "@media (hover: none)": {
          opacity: 1,
        },
      },
      false: {
        opacity: 1,
      },
    },
  },
  defaultVariants: {
    showOnHover: false,
  },
});

/** A weak or lost connection: warning colour plus its own icon shape */
const WeakConnection = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    color: "var(--z-status-warning)",
    "--z-icon-color": "var(--z-status-warning)",
  },
});

const LiveQuality = styled("span", {
  base: {
    whiteSpace: "nowrap",
    fontSize: "11px",
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
    opacity: 0.85,
  },
  variants: {
    limited: {
      true: { color: "var(--z-status-warning)", opacity: 1 },
    },
  },
});

const OverlayInner = styled("div", {
  base: {
    minWidth: 0,
    maxWidth: "100%",

    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    gap: "8px",
    padding: "4px 10px",
    borderRadius: "var(--borderRadius-md)",
    fontSize: "13px",
    fontWeight: 600,
    color: "#fff",
    // no backdrop blur: over a playing video it is redone on every frame
    background: "rgba(0, 0, 0, .65)",
    "--z-icon-color": "currentColor",
  },
});

/** Sound on/off for a stream, on the tile itself (24 px target) */
const StreamSoundButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    marginBlock: "-4px",
    marginInlineEnd: "-6px",
    border: "none",
    borderRadius: "var(--borderRadius-full, 999px)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    // the overlay around it lets clicks through to the tile
    pointerEvents: "auto",
    _hover: { background: "rgba(255, 255, 255, .16)" },
    _focusVisible: {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "1px",
    },
    "&[data-stream-sound='off']": { color: "var(--z-danger, #F27488)" },
  },
});
