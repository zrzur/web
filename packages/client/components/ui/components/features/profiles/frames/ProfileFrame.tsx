import {
  type JSX,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { styled } from "styled-system/jsx";

import Breakpoint from "@revolt/common/Breakpoint";
import { useInstance } from "@revolt/instance";

import { useDesignMotion } from "../NameplateMotion";
import { communityFileUrl, isCommunityRef } from "../userStyle";

import { frameBorderImage } from "./communityFrame";
import { isProfileFrameId } from "./frameIds";
import { FRAME_FACTS, fitCell, frameRoomOf } from "./frameRoom";
import "./frames.css";

/**
 * The frame around a whole profile card. Put it inside a box that is the
 * card's size and `position: relative` (`FramedCard` does this), next to the
 * card rather than in it: the card clips what overflows it, and the frame
 * reaches past its edges.
 *
 * It never takes a click or a scroll (`pointer-events: none`), is hidden from
 * screen readers, and adds nothing to the layout. On a phone it is drawn with
 * smaller pixels; it may reach past the sheet's top and sides like the card's
 * own popout does on a desktop.
 */
export function ProfileFrame(props: {
  /** built-in id, or `c:<id>` for a community frame */
  frame?: string;
  /** file of a community frame (filled in by the server) */
  file?: string;
  /**
   * a community frame's picture by address instead of `file`: a file a
   * creator picked and has not uploaded yet
   */
  url?: string;
  /** a phone-sized card; left out, a phone-sized window says */
  phone?: boolean;
  /** pixel size of a built-in frame; left out, the box's width says */
  cell?: number;
}) {
  const instance = useInstance();
  const motion = useDesignMotion();
  const [size, setSize] = createSignal<{ w: number; h: number }>();
  const [narrow, setNarrow] = createSignal(false);
  const phone = () => props.phone ?? narrow();
  let layer!: HTMLDivElement;

  onMount(() => {
    if (typeof matchMedia === "function") {
      const query = matchMedia(Breakpoint.phone);
      setNarrow(query.matches);
      const change = () => setNarrow(query.matches);
      query.addEventListener?.("change", change);
      onCleanup(() => query.removeEventListener?.("change", change));
    }
  });

  onMount(() => {
    const measure = () => {
      const w = layer.clientWidth;
      const h = layer.clientHeight;
      if (w && h) setSize({ w, h });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    onCleanup(() => observer.disconnect());
  });

  const builtIn = () =>
    isProfileFrameId(props.frame) ? props.frame : undefined;
  const communityUrl = () =>
    isCommunityRef(props.frame)
      ? (props.url ?? communityFileUrl(instance.mediaUrl, props.file))
      : undefined;

  // the drawings load the first time a built-in frame is shown, so the app's
  // first load carries no frame art; a frame drawn ahead of time loads its
  // own file then
  const [drawings] = createResource(builtIn, async (id) => {
    const art = await import("./builtinFrames");
    await art.loadFrameArt(id);
    // a new object each time, so a second frame's art wakes the drawing too
    return { art, id };
  });
  const drawn = () => {
    const id = builtIn();
    const box = size();
    const loaded = drawings();
    // while another frame's file loads, the last one is still here
    if (!id || !box || loaded?.id !== id) return undefined;
    return loaded.art.profileFrameSvg(id, box.w, box.h, {
      phone: phone(),
      cell: props.cell,
    });
  };

  const moving = () => {
    const id = builtIn();
    return !!id && FRAME_FACTS[id].moves && motion();
  };

  return (
    <Layer
      ref={layer}
      aria-hidden="true"
      data-profile-frame={props.frame ?? ""}
      data-phone={phone() ? "" : undefined}
      data-moving={moving() ? "" : undefined}
    >
      <Show when={size()}>
        {(box) => (
          <Switch>
            <Match when={drawn()}>
              {(art) => (
                <Art
                  style={{
                    left: `${-art().room.x}px`,
                    top: `${-art().room.top}px`,
                  }}
                  // numbers and our own colours only (builtinFrames.ts)
                  // eslint-disable-next-line solid/no-innerhtml
                  innerHTML={art().svg}
                />
              )}
            </Match>
            <Match when={communityUrl()}>
              {(url) => <Picture style={frameBorderImage(url(), box().w)} />}
            </Match>
          </Switch>
        )}
      </Show>
    </Layer>
  );
}

/**
 * A box the size of the card that also holds its frame. The card goes in as
 * the child; nothing about its own layout changes.
 *
 * With `fit` (a profile shown in the window: the card beside a name, the full
 * profile) the frame is drawn with smaller pixels on shorter windows
 * (`fitCell`), and the box says the room its frame takes round it, so the
 * profile can be sized and placed with the whole frame on screen:
 * `--z-frame-x`, `--z-frame-top` and `--z-frame-bottom` for its styles, and
 * `data-frame-room` for the code that places popups (`readFrameRoom`).
 */
export function FramedCard(props: {
  frame?: string;
  file?: string;
  /** a community frame's picture by address (`ProfileFrame` `url`) */
  url?: string;
  phone?: boolean;
  fit?: boolean;
  children: JSX.Element;
  class?: string;
}) {
  const [width, setWidth] = createSignal(0);
  const [tall, setTall] = createSignal(
    typeof window === "undefined" ? Infinity : window.innerHeight,
  );
  const [narrow, setNarrow] = createSignal(false);
  let host!: HTMLDivElement;

  onMount(() => {
    if (!props.fit) return;
    if (typeof matchMedia === "function") {
      const query = matchMedia(Breakpoint.phone);
      setNarrow(query.matches);
      const change = () => setNarrow(query.matches);
      query.addEventListener?.("change", change);
      onCleanup(() => query.removeEventListener?.("change", change));
    }
    const measure = () => {
      setWidth(host.clientWidth);
      setTall(window.innerHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    onCleanup(() => window.removeEventListener("resize", measure));
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    onCleanup(() => observer.disconnect());
  });

  const cell = () =>
    props.fit && props.frame
      ? fitCell(width() || 360, {
          phone: props.phone ?? narrow(),
          windowHeight: tall(),
        })
      : undefined;
  const room = () => {
    const c = cell();
    return c === undefined ? undefined : frameRoomOf(props.frame, width(), c);
  };
  const px = (n: number) => `${Math.ceil(n)}px`;

  return (
    <Host
      ref={host}
      class={props.class}
      data-frame-host
      data-framed={props.frame ? "" : undefined}
      data-frame-cell={cell()}
      data-frame-room={
        room()
          ? `${Math.ceil(room()!.x)} ${Math.ceil(room()!.top)} ${Math.ceil(room()!.bottom)}`
          : undefined
      }
      style={
        room()
          ? {
              "--z-frame-x": px(room()!.x),
              "--z-frame-top": px(room()!.top),
              "--z-frame-bottom": px(room()!.bottom),
            }
          : undefined
      }
    >
      {props.children}
      <Show when={props.frame}>
        <ProfileFrame
          frame={props.frame}
          file={props.file}
          url={props.url}
          phone={props.phone}
          cell={cell()}
        />
      </Show>
    </Host>
  );
}

const Host = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    maxWidth: "100%",
  },
});

const Layer = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    pointerEvents: "none",
    userSelect: "none",
  },
});

const Art = styled("div", {
  base: {
    position: "absolute",
    lineHeight: 0,
    "& svg": { display: "block", overflow: "visible" },
    // the drawing's big cluster sits at the top start: on the right in RTL.
    // The room is the same on both sides, so it turns round in place.
    _rtl: { transform: "scaleX(-1)" },
  },
});

const Picture = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    borderWidth: 0,
  },
});
