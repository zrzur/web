import {
  JSX,
  Match,
  Show,
  Switch,
  createContext,
  createEffect,
  createSignal,
  lazy,
  type ComponentProps,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";
import { Portal } from "solid-js/web";

import { createResizeObserver } from "@solid-primitives/resize-observer";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import { useVoice } from "@revolt/rtc";
import { VoiceLayout } from "@revolt/rtc/state";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import { SlideState } from "@revolt/ui/components/navigation/SlideDrawer";

import { VoiceCallCardPreview } from "./VoiceCallCardPreview";

type Mode = "floating" | "moving";
type FloatType = "tl" | "tr" | "bl" | "br";

const CORNER_KEY = "zrzur:voice-card-corner";

// The call views use LiveKit, which loads with the first call
const VoiceCallCardActiveRoom = lazy(() =>
  import("./LiveRoom").then((m) => ({ default: m.ActiveRoom })),
);
const VoiceCallCardPiP = lazy(() =>
  import("./LiveRoom").then((m) => ({ default: m.PictureInPicture })),
);

/** The corner the floating call card was last put in (per device) */
function savedCorner(): FloatType {
  try {
    const value = localStorage.getItem(CORNER_KEY);
    if (value === "tl" || value === "tr" || value === "bl" || value === "br")
      return value;
  } catch {
    /* storage blocked: use the default */
  }
  return "tr";
}

function saveCorner(corner: FloatType) {
  try {
    localStorage.setItem(CORNER_KEY, corner);
  } catch {
    /* storage blocked: the card still moves, it just isn't remembered */
  }
}

type Info = {
  channel: Channel;
  pos: DOMRect;
  parentRect: DOMRect;
  drawer?: SlideState;
  /** voice channel page: the call fills the whole channel view */
  stage?: boolean;
};

const PAD = 16,
  PAD_X = `${PAD}px`,
  PAD_Y = `${PAD + 56}px`;

const callCardContext = createContext<(info?: Info) => void>();

/** Voice call card context */
export function VoiceCallCardContext(props: { children: JSX.Element }) {
  const voice = useVoice();
  const state = useState();
  const device = useDevice();
  const inCall = () => !!voice.channel();

  const [mode, setMode] = createSignal<Mode>();
  const [info, setInfo] = createSignal<Info>();

  let ref: HTMLDivElement | undefined,
    events: AbortController | null,
    pid = 0,
    ofsX = 0,
    ofsY = 0;

  function mouseDown(e: PointerEvent) {
    pid = e.pointerId;
    if (mode() === "floating") {
      const pos = ref!.getBoundingClientRect();
      ofsX = e.clientX - pos.x;
      ofsY = e.clientY - pos.y;
      setMode("moving");
      addEvents();
    }
  }

  function mouseMove(e: PointerEvent) {
    if (e.pointerId !== pid) return;
    e.preventDefault();
    const x = e.clientX - ofsX,
      y = e.clientY - ofsY;
    ref!.style.transform = `translate(${x}px, ${y}px)`;
  }

  function mouseUp(e: PointerEvent) {
    if (e.pointerId !== pid) return;
    const sty = ref!.style,
      pos = ref!.getBoundingClientRect(),
      left = e.clientX - ofsX + pos.width / 2 < innerWidth / 2,
      top = e.clientY - ofsY + pos.height / 2 < innerHeight / 2;

    sty.transition = "all .2s cubic-bezier(0, 1.5, 0.85, 0.8)";
    const corner = left ? (top ? "tl" : "bl") : top ? "tr" : "br";
    saveCorner(corner);
    setFloat(corner);
    //Reset CSS transition on next render pass
    setTimeout(() => (sty.transition = ""), 1);
    resetEvents();
  }

  function addEvents() {
    if (events) return;
    events = new AbortController();
    const opt = { passive: false, signal: events.signal };
    document.addEventListener("pointermove", mouseMove, opt);
    document.addEventListener("pointerup", mouseUp, opt);
  }

  function resetEvents() {
    events?.abort();
    events = null;
  }

  createEffect(() => {
    const inf = info();
    if (!ref) return;
    const sty = ref.style;
    resetEvents();

    //Set mode based on state
    if (voice.layout() === "fullscreen") {
      sty.transform = ``;
      sty.width = `100%`;
      sty.height = "";
      setMode();
    } else if (
      (voice.layout() === "expanded" || inf?.stage) &&
      inf?.parentRect &&
      (!inf.drawer || inf.drawer === SlideState.SHOWN)
    ) {
      sty.transform = `translate(${inf.parentRect.x}px, ${inf.parentRect.y}px)`;
      sty.width = `${inf.parentRect.width}px`;
      sty.height = `${inf.parentRect.height}px`;
      setMode();
    } else if (inf?.pos && (!inf.drawer || inf.drawer === SlideState.SHOWN)) {
      sty.transform = `translate(${inf.pos.x}px, ${inf.pos.y}px)`;
      sty.width = `${inf.pos.width}px`;
      sty.height = voice.layout() === "collapsed" ? "56px" : "";
      setMode();
    } else if (!inCall()) {
      const y = inf?.pos.y ?? ref.getBoundingClientRect().y;
      sty.transform = `translate(${innerWidth + 50}px, ${y}px)`;
      sty.width = "";
      sty.height = "";
      setMode();
    } else if (!mode()) setFloat(savedCorner());
  });

  const channel = () => info()?.channel;

  // audio-only calls are handled by the "voice connected" strip in the
  // sidebar; the floating card is for video, or when that strip is hidden
  const showPiP = () =>
    device.layout() !== "desktop" ||
    !state.layout.getSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true) ||
    voice
      .vidTracks()
      .some((track) => track.publication && !track.publication.isMuted);

  function setFloat(float: FloatType) {
    // the card is fixed to the screen, outside #root: its corners stay
    // inside the safe area (notch, status bar, home bar)
    const sty = ref!.style,
      x =
        float[1] === "l"
          ? `calc(${PAD_X} + var(--z-safe-left, 0px))`
          : `calc(100vw - var(--flt-w) - ${PAD_X} - var(--z-safe-right, 0px))`,
      y =
        float[0] === "t"
          ? `calc(${PAD_Y} + var(--z-safe-top, 0px))`
          : `calc(100vh - var(--flt-h) - ${PAD_Y} - var(--z-safe-bottom, 0px))`;
    sty.transform = `translate(${x}, ${y})`;
    sty.width = "";
    sty.height = "";
    setMode("floating");
  }

  onCleanup(resetEvents);

  onMount(() => {
    document
      .getElementById("floating")
      ?.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) voice.resetLayout();
      });
  });

  createEffect(() => {
    if (voice.layout() === "fullscreen" && inCall()) {
      if (
        !document
          .getElementById("floating")
          ?.isSameNode(document.fullscreenElement)
      ) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        document.getElementById("floating")?.requestFullscreen();
      }
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  });

  return (
    <callCardContext.Provider value={setInfo}>
      {props.children}
      <Portal mount={document.getElementById("floating")! as HTMLDivElement}>
        <Float
          ref={ref}
          mode={mode()}
          onPointerDown={mouseDown}
          fullscreen={voice.layout() === "fullscreen"}
        >
          <Switch>
            <Match when={mode() && inCall() && showPiP()}>
              <VoiceCallCardPiP />
            </Match>
            <Match when={channel()}>
              <VoiceCallCard
                channel={channel()!}
                inCall={inCall()}
                showCard={voice.showCard(channel()!)}
                layout={voice.layout()}
                stage={info()?.stage}
              />
            </Match>
          </Switch>
        </Float>
      </Portal>
    </callCardContext.Provider>
  );
}

const Float = styled("div", {
  base: {
    position: "fixed",
    // The card is moved with translate(x, y) in screen coordinates, measured
    // from the top-left corner. Pin it there: left to its natural spot, a
    // right-to-left page (Arabic) puts it at the right edge and every
    // position ends up shifted off its target.
    top: 0,
    left: 0,
    zIndex: 10,
    pointerEvents: "none",
    transition: "all .3s cubic-bezier(1, 0, 0, 1)",
    height: "40vh",
    touchAction: "none",
  },
  variants: {
    mode: {
      floating: { cursor: "grab" },
      moving: {
        cursor: "grabbing",
        transition: "none",
      },
    },
    fullscreen: {
      true: {
        zIndex: 100,
        height: "100vh",
        top: 0,
        // the whole screen: the call controls stay clear of the notch and
        // the home bar (physical sides: cut-outs do not mirror in Arabic)
        paddingTop: "var(--z-safe-top)",
        paddingBottom: "var(--z-safe-bottom)",
        paddingLeft: "var(--z-safe-left)",
        paddingRight: "var(--z-safe-right)",
        // Width is set by floating logic in effect above
      },
    },
  },
  compoundVariants: [
    {
      mode: ["floating", "moving"],
      css: {
        "--flt-w": "300px",
        "--flt-h": "170px",
        width: "var(--flt-w)",
        height: "var(--flt-h)",
      },
    },
  ],
});

/** 'Marker' to send position information for mounting the floating call card */
export function VoiceChannelCallCardMount(props: {
  channel: Channel;
  stage?: boolean;
}) {
  const voice = useVoice();
  const state = useState();
  const setInfo = useContext(callCardContext)!;
  let ref: HTMLDivElement | undefined;

  function updateInfo() {
    const vc = voice.channel();
    setInfo(
      !vc || vc.id === props.channel.id
        ? {
            channel: props.channel,
            pos: ref!.getBoundingClientRect(),
            parentRect: ref!.parentElement!.getBoundingClientRect(),
            drawer: state.appDrawer()?.state,
            stage: props.stage,
          }
        : undefined,
    );
  }

  createEffect(updateInfo);

  onMount(() => {
    const target = ref?.parentElement;
    if (!target) return;

    createResizeObserver(target, updateInfo);
  });
  onCleanup(() => {
    setInfo();
  });

  return <div ref={ref!} />;
}

/**
 * Call card
 */
function VoiceCallCard(props: {
  channel: Channel;
  inCall: boolean;
  showCard: boolean;
  layout: VoiceLayout;
  stage?: boolean;
}) {
  const stage = () => props.stage && props.layout !== "fullscreen";

  return (
    <Show when={props.showCard}>
      <Base layout={(stage() ? "expanded" : props.layout) as ComponentProps<typeof Base>["layout"]}>
        <Card active={props.inCall} layout={props.layout} stage={stage()}>
          <Show
            when={props.inCall}
            fallback={<VoiceCallCardPreview channel={props.channel} />}
          >
            <VoiceCallCardActiveRoom />
          </Show>
        </Card>
      </Base>
    </Show>
  );
}

const Base = styled("div", {
  base: {
    left: 0,
    top: "var(--gap-md)",
    padding: "var(--gap-md)",

    width: "100%",
    height: "100%",
    position: "absolute",

    zIndex: 2,
    userSelect: "none",
    pointerEvents: "none",

    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    transition: "all var(--transitions-medium)",
  },
  variants: {
    layout: {
      fullscreen: {
        top: 0,
        height: "100%",
        padding: 0,
      },
      expanded: {
        top: 0,
        height: "100%",
        padding: 0,
      },
    },
  },
});

const Card = styled("div", {
  base: {
    pointerEvents: "all",

    maxWidth: "100%",
    transition: "var(--transitions-fast) all",
    transitionTimingFunction: "ease-in-out",

    borderRadius: "var(--borderRadius-lg)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    border: "1px solid var(--z-btn-surface-border)",
  },
  variants: {
    active: {
      true: {
        width: "100%",
        height: "100%",
      },
      false: {
        width: "360px",
        minHeight: "160px",
        cursor: "pointer",
      },
    },
    layout: {
      fullscreen: {
        borderRadius: 0,
      },
      expanded: {
        borderRadius: "var(--borderRadius-xl)",
      },
      collapsed: {
        background: "none",
      },
    },
    stage: {
      true: {
        background: "transparent",
        border: "none",
        borderRadius: 0,
      },
    },
  },
});
