import { useLingui } from "@lingui/solid/macro";
import { createResizeObserver } from "@solid-primitives/resize-observer";
import { createEffect, createMemo, For, on, onMount, Show } from "solid-js";
import { TrackLoop } from "solid-livekit-components";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";
import { InRoom, useVoice } from "@revolt/rtc";
import { IconButton } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { scrollableStyles } from "@revolt/ui/directives";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  setSoundboardOpen,
  soundboardOpen,
} from "../soundboard/soundboardOpen";

import { lazyRetry } from "../../../utils/lazyRetry";
import SoundsUnavailable from "../soundboard/SoundsUnavailable";

import { controlsRoom } from "../rooms/roomControlsOpen";

import { WeakNetworkSign } from "../WeakNetworkSign";

import { ParticipantTile, tile } from "./ParticipantTile";
import { VoiceCallCardActions } from "./VoiceCallCardActions";
import { VoiceCallCardStatus } from "./VoiceCallCardStatus";

// only a stage call loads the stage controls, and the first open the sounds
// (lazyRetry keeps the wait inside the part: see there)
const StagePanel = lazyRetry(
  () => import("../stage/StagePanel"),
  () => null,
);
// clips and recording: only a server call loads them (the panel shows
// nothing where the server has both features off)
const CapturePanel = lazyRetry(
  () => import("../capture/CapturePanel"),
  () => null,
);
const SoundboardPicker = lazyRetry(
  () => import("../soundboard/SoundboardPicker"),
  SoundsUnavailable,
);

/** Whether the server has clips or recorded rooms on */
function captureOn(client: ReturnType<ReturnType<typeof useClient>>) {
  const features = client.configuration?.features as
    | { voice_clips?: boolean; voice_recordings?: boolean }
    | undefined;
  return !!features?.voice_clips || !!features?.voice_recordings;
}

/**
 * Call card (active)
 */
export function VoiceCallCardActiveRoom() {
  const voice = useVoice();
  const { layout } = useDevice();
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const collapsed = createMemo(() => voice.layout() === "collapsed");
  // desktop: every call button sits in the voice card at the bottom of the
  // channel list (AccountBar), so the room shows no second row of them. A
  // phone has no such card, and full screen covers it: there they stay here.
  const ownControls = () =>
    layout() === "phone" || voice.layout() === "fullscreen";
  // a new call starts with the soundboard closed
  createEffect(
    on(
      () => voice.channel()?.id,
      () => setSoundboardOpen(false),
    ),
  );

  return (
    <View collapsed={collapsed()}>
      <Show when={!collapsed() && voice.channel()?.isStage && voice.channel()}>
        {(channel) => <StagePanel channel={channel()} />}
      </Show>
      <Show when={!collapsed()}>
        <WeakNetworkSign />
      </Show>
      <Show
        when={
          !collapsed() &&
          voice.channel()?.server &&
          captureOn(client()) &&
          voice.channel()
        }
      >
        {(channel) => <CapturePanel channel={channel()} />}
      </Show>
      <Participants />
      <Show
        when={
          !collapsed() &&
          ownControls() &&
          soundboardOpen() &&
          voice.channel()?.server &&
          voice.channel()
        }
      >
        {(channel) => <SoundboardPicker channel={channel()} />}
      </Show>
      {/* a phone's call bar has no room for a seventh button: your own
          temporary room gets its controls from here */}
      <Show
        when={
          !collapsed() &&
          layout() === "phone" &&
          controlsRoom(voice.channel(), client().user?.id)
        }
      >
        <RoomPill
          type="button"
          data-voice-control="room"
          onClick={() =>
            openModal({ type: "room_controls", channel: voice.channel()! })
          }
        >
          <Icon
            name={
              voice.channel()?.voice?.locked
                ? "lock-simple"
                : "lock-simple-open"
            }
            size={18}
          />
          {t`Room controls`}
        </RoomPill>
      </Show>
      <VoiceCallControls phone={layout() === "phone"}>
        <VoiceCallControlHolder left collapsed={collapsed()}>
          {/* the voice card already says "Connected" on desktop: here only
              the notices (reconnected, a device unplugged, rejoin) */}
          <VoiceCallCardStatus noticesOnly={!ownControls()} />
        </VoiceCallControlHolder>
        <Show when={ownControls()}>
          <VoiceCallCardActions size="sm" />
        </Show>
        <VoiceCallControlHolder right collapsed={collapsed()}>
          <LayoutButtons />
        </VoiceCallControlHolder>
      </VoiceCallControls>
    </View>
  );
}

const RoomPill = styled("button", {
  base: {
    alignSelf: "center",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    paddingInline: "16px",
    marginBlockEnd: "8px",
    border: "1px solid var(--z-border-subtle)",
    borderRadius: "999px",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

/**
 * Only fullscreen remains: the voice room already fills the channel view
 */
function LayoutButtons() {
  const voice = useVoice();
  const { t } = useLingui();

  const label = () =>
    voice.layout() === "fullscreen" ? t`Exit full screen` : t`Full screen`;

  return (
    <IconButton
      size="sm"
      variant="toolbar"
      aria-label={label()}
      onPress={() => voice.toggleLayout("fullscreen")}
      use:floating={{
        tooltip: {
          placement: "top",
          content: label(),
        },
      }}
    >
      <Show
        when={voice.layout() === "fullscreen"}
        fallback={<Icon name="arrows-out" size={20} />}
      >
        <Icon name="arrows-in" size={20} />
      </Show>
    </IconButton>
  );
}

const TILE_MIN_WIDTH = "250px",
  TILE_MIN_FOCUS_HEIGHT = "100px";

/**
 * Show a grid of participants
 */
function Participants() {
  const voice = useVoice();
  const { t } = useLingui();

  // Modify this value to get test tracks
  const testTrackCount = 0;

  let callRef: HTMLDivElement | undefined;

  const tileWidth = () => {
    const vidWidth = Math.round(
      100 / (voice.vidTracks().length + testTrackCount),
    );
    return `max(${TILE_MIN_WIDTH}, ${vidWidth}% - var(--gap-md))`;
  };

  // a focus whose track left ends by itself (rtc/state.tsx: focusId)

  onMount(() => {
    createResizeObserver(callRef, ({ width, height }, el) => {
      if (el === callRef) {
        el.style.setProperty("--vc-w", `${width}px`);
        el.style.setProperty("--vc-h", `${height}px`);
      }
    });
  });

  return (
    <Call ref={callRef} class={voice.focusId() ? "" : scrollableStyles()}>
      <InRoom>
        <FocusedParticipant />
        <Show when={voice.focusId()}>
          <ShowBarButtonHolder>
            <div style={{ "margin-bottom": "10px" }}>
              <IconButton
                size="xs"
                variant={"tonal"}
                onPress={() => voice.toggleShowBar()}
                use:floating={{
                  tooltip: {
                    placement: "top",
                    content: voice.showBar() ? t`Hide others` : t`Show others`,
                  },
                }}
              >
                <Show
                  when={voice.showBar()}
                  fallback={<Symbol>keyboard_arrow_up</Symbol>}
                >
                  <Symbol>keyboard_arrow_down</Symbol>
                </Show>
              </IconButton>
            </div>
          </ShowBarButtonHolder>
        </Show>
        <Grid
          focus={!!voice.focusId()}
          show={voice.showBar()}
          class={voice.focusId() ? scrollableStyles({ direction: "x" }) : ""}
          style={{ "--vc-tile-width": tileWidth() }}
        >
          <TrackLoop
            tracks={() => voice.vidTracks().filter((t) => !voice.isFocus(t))}
          >
            {() => <ParticipantTile />}
          </TrackLoop>
          <For each={Array(testTrackCount)}>
            {() => (
              <div
                class={
                  tile({ fullscreen: voice.layout() === "fullscreen" }) +
                  " vc_tile"
                }
              />
            )}
          </For>
        </Grid>
      </InRoom>
    </Call>
  );
}

function FocusedParticipant() {
  const voice = useVoice();

  return (
    <Show when={voice.focusTrack()}>
      <TrackLoop tracks={() => [voice.focusTrack()!]}>
        {() => (
          <FocusBox>
            <ParticipantTile focus />
          </FocusBox>
        )}
      </TrackLoop>
    </Show>
  );
}

const View = styled("div", {
  base: {
    minHeight: 0,
    height: "100%",
    width: "100%",

    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    transition: "padding var(--transitions-medium)",
  },
  variants: {
    collapsed: {
      true: { padding: 0 },
    },
  },
});

const VoiceCallControls = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,
    overflow: "hidden",
  },
  variants: {
    // a phone is too narrow for notices, buttons and full screen in one
    // row: the buttons get the whole width, notices sit above them, and
    // full screen goes (the call already fills the screen)
    phone: {
      true: {
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        "& > div:first-child": {
          flex: "0 0 auto",
          padding: 0,
          justifyContent: "center",
          "&:empty": { display: "none" },
        },
        "& > div:last-child": { display: "none" },
      },
    },
  },
});

const VoiceCallControlHolder = styled("div", {
  base: {
    display: "flex",
    flex: 1,
    alignSelf: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    opacity: 1,
    transition: "opacity var(--transitions-medium)",
  },
  variants: {
    left: {
      true: {
        justifyContent: "flex-start",
        overflow: "hidden",
        // a long status (e.g. a permission notice) wraps instead of
        // running under the call controls in the middle
        minWidth: 0,
      },
    },
    right: {
      true: {
        justifyContent: "flex-end",
      },
    },
    collapsed: {
      true: {
        opacity: 0,
        pointerEvents: "none",
      },
    },
  },
});

const ShowBarButtonHolder = styled("div", {
  base: {
    height: 0,
    alignSelf: "center",
    overflow: "visible",
    display: "flex",
    flexDirection: "column-reverse",
  },
});

const Call = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    flexGrow: 1,
    minHeight: 0,
  },
});

const Grid = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "safe center",
    alignContent: "safe center",
    minHeight: "100%",
    gap: "var(--gap-md)",
  },

  variants: {
    focus: {
      true: {
        flexDirection: "column",
        height: `max(20%, ${TILE_MIN_FOCUS_HEIGHT})`,
        minHeight: 0,
        transition: "height .3s ease",

        "& .vc_tile": {
          width: "auto",
          height: "100%",
        },
      },
    },
    show: {
      false: {
        height: 0,
      },
    },
  },
});

const FocusBox = styled("div", {
  base: {
    height: 0,
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    margin: "0 auto",
  },
});
