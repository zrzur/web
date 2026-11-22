import {
  type ComponentProps,
  JSX,
  Match,
  Show,
  Switch,
  createContext,
  createEffect,
  createSignal,
  lazy,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";
import { Portal } from "solid-js/web";

import { createResizeObserver } from "@solid-primitives/resize-observer";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useVoice } from "@revolt/rtc";
import { VoiceLayout } from "@revolt/rtc/state";
import { useState } from "@revolt/state";
import { SlideState } from "@revolt/ui/components/navigation/SlideDrawer";

import { VoiceCallCardPreview } from "./VoiceCallCardPreview";
import {
  type Corner,
  EDGE_GAP,
  type Insets,
  type Size,
  clampToViewport,
  cornerPosition,
  createDragGesture,
  isCorner,
  nearestCorner,
} from "./floatingDrag";
import { voiceStripOnScreen } from "./voiceStrip";

type Mode = "floating" | "moving";

const CORNER_KEY = "zrzur:voice-card-corner";

// The call views use LiveKit, which loads with the first call
const VoiceCallCardActiveRoom = lazy(() =>
  import("./LiveRoom").then((m) => ({ default: m.ActiveRoom })),
);
const VoiceCallCardPiP = lazy(() =>
  import("./LiveRoom").then((m) => ({ default: m.PictureInPicture })),
);

/** The corner the floating call card was last put in (per device) */
function savedCorner(): Corner {
  try {
    const value = localStorage.getItem(CORNER_KEY);
    if (isCorner(value)) return value;
  } catch {
    /* storage blocked: use the default */
  }
  return "tr";
}

function saveCorner(corner: Corner) {
  try {
    localStorage.setItem(CORNER_KEY, corner);
  } catch {
    /* storage blocked: the card still moves, it just isn't remembered */
  }
}

/** Size of the floating card (px); narrower on a very small screen */
const FLOAT_W = 300,
  FLOAT_H = 170;

/** The part of the page that is really on screen (px) */
function viewport(): Size {
  return {
    width: document.documentElement.clientWidth || innerWidth,
    height: innerHeight,
  };
}

function floatSize(view: Size): Size {
  return {
    width: Math.max(0, Math.min(FLOAT_W, view.width - 2 * EDGE_GAP)),
    height: Math.max(0, Math.min(FLOAT_H, view.height - 2 * EDGE_GAP)),
  };
}

/** The safe area (notch, status bar, home bar) in pixels */
function safeInsets(): Insets {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;" +
    "padding:var(--z-safe-top,0px) var(--z-safe-right,0px) var(--z-safe-bottom,0px) var(--z-safe-left,0px)";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

type Info = {
  channel: Channel;
  pos: DOMRect;
  parentRect: DOMRect;
  drawer?: SlideState;
  /** voice channel page: the call fills the whole channel view */
  stage?: boolean;
};

const callCardContext = createContext<(info?: Info) => void>();

/** Voice call card context */
export function VoiceCallCardContext(props: { children: JSX.Element }) {
  const voice = useVoice();
  const state = useState();
  const inCall = () => !!voice.channel();

  const [mode, setMode] = createSignal<Mode>();
  const [info, setInfo] = createSignal<Info>();

  let ref: HTMLDivElement | undefined,
    corner: Corner = savedCorner();

  // A press is a tap (the card's own click opens the call) until it moves
  // past the threshold; then it is a drag, which never opens the call
  // (bug #9). Its buttons never start one.
  const drag = createDragGesture({
    element: () => (mode() === "floating" ? ref : undefined),
    onStart: () => setMode("moving"),
    onMove: (point) => {
      const view = viewport();
      const p = clampToViewport(point, floatSize(view), view);
      ref!.style.transform = `translate(${p.x}px, ${p.y}px)`;
    },
    onDrop: (point) => {
      const sty = ref!.style,
        view = viewport();
      corner = nearestCorner(point, floatSize(view), view);
      saveCorner(corner);
      sty.transition = "all .2s cubic-bezier(0, 1.5, 0.85, 0.8)";
      setFloat(corner);
      //Reset CSS transition on next render pass
      setTimeout(() => (sty.transition = ""), 1);
    },
  });

  createEffect(() => {
    const inf = info();
    if (!ref) return;
    const sty = ref.style;

    //Set mode based on state
    if (voice.layout() === "fullscreen") {
      drag.cancel();
      sty.transform = ``;
      sty.width = `100%`;
      sty.height = "";
      setMode();
    } else if (
      (voice.layout() === "expanded" || inf?.stage) &&
      inf?.parentRect &&
      (!inf.drawer || inf.drawer === SlideState.SHOWN)
    ) {
      drag.cancel();
      sty.transform = `translate(${inf.parentRect.x}px, ${inf.parentRect.y}px)`;
      sty.width = `${inf.parentRect.width}px`;
      sty.height = `${inf.parentRect.height}px`;
      setMode();
    } else if (inf?.pos && (!inf.drawer || inf.drawer === SlideState.SHOWN)) {
      drag.cancel();
      sty.transform = `translate(${inf.pos.x}px, ${inf.pos.y}px)`;
      sty.width = `${inf.pos.width}px`;
      sty.height = voice.layout() === "collapsed" ? "56px" : "";
      setMode();
    } else if (!inCall()) {
      drag.cancel();
      const y = inf?.pos.y ?? ref.getBoundingClientRect().y;
      sty.transform = `translate(${innerWidth + 50}px, ${y}px)`;
      sty.width = "";
      sty.height = "";
      setMode();
    } else if (!mode()) setFloat(savedCorner());
  });

  // the window changed size (a phone turned, the browser bar came or went):
  // the card stays in its corner, on screen
  const keepInCorner = () => {
    if (mode() === "floating") setFloat(corner);
  };
  onMount(() => {
    addEventListener("resize", keepInCorner);
    visualViewport?.addEventListener("resize", keepInCorner);
  });
  onCleanup(() => {
    drag.cancel();
    removeEventListener("resize", keepInCorner);
    visualViewport?.removeEventListener("resize", keepInCorner);
  });

  const channel = () => info()?.channel;

  // audio-only calls are handled by the "voice connected" strip; the floating
  // card is for video, or when that strip is not on screen. On a phone the
  // strip shows with the channel list, so the card no longer covers the list;
  // in a channel the strip is off screen and the card comes back.
  // On a phone a channel page slides over the list, and the strip stays on
  // screen underneath it: the app drawer says which of the two is shown.
  const stripShown = () =>
    voiceStripOnScreen() && state.appDrawer()?.state !== SlideState.SHOWN;
  const showPiP = () =>
    !stripShown() ||
    voice
      .vidTracks()
      .some((track) => track.publication && !track.publication.isMuted);

  function setFloat(float: Corner) {
    // the card is fixed to the screen, outside #root: it is placed in
    // pixels of the part of the page really on screen (100vh is taller than
    // that in a phone browser), clear of the header, the composer and the
    // safe area (notch, status bar, home bar)
    corner = float;
    const sty = ref!.style,
      view = viewport(),
      size = floatSize(view),
      p = cornerPosition(float, size, view, safeInsets());
    sty.transform = `translate(${p.x}px, ${p.y}px)`;
    sty.width = `${size.width}px`;
    sty.height = `${size.height}px`;
    setMode("floating");
  }

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
          onPointerDown={(e) => drag.pointerDown(e)}
          fullscreen={voice.layout() === "fullscreen"}
        >
          <Switch>
            {/* floating: the small card, or nothing while the strip shows.
                Never the full call card: it covered the channel list */}
            <Match when={mode() && inCall()}>
              <Show when={showPiP()}>
                <VoiceCallCardPiP />
              </Show>
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
      <Base
        layout={
          (stage() ? "expanded" : props.layout) as ComponentProps<
            typeof Base
          >["layout"]
        }
      >
        <Card
          active={props.inCall}
          layout={props.layout}
          stage={stage()}
          data-conversation-call={stage() ? undefined : ""}
        >
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

    // Phones, a call in a direct message or group: the card is a strip over
    // the conversation, too short for people one under another (the second
    // person was cut off behind the buttons). They sit side by side, each
    // as tall as the strip; more than two are reached by a sideways swipe.
    _phone: {
      "&[data-conversation-call] :has(> .vc_tile)": {
        flexWrap: "nowrap",
        justifyContent: "safe center",
        alignContent: "stretch",
        alignItems: "stretch",
        gap: "8px",
        minHeight: 0,
        height: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
      },
      "&[data-conversation-call] .vc_tile": {
        flex: "0 0 calc(50% - 4px)",
        width: "auto !important",
        maxWidth: "none !important",
        height: "100% !important",
        minHeight: 0,
        aspectRatio: "auto",
      },
      "&[data-conversation-call] .vc_tile:only-child": {
        flex: "0 0 100%",
      },
    },
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
