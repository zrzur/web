import { type JSX, Show, createSignal, onCleanup, onMount } from "solid-js";

import { styled } from "styled-system/jsx";

import Breakpoint from "@revolt/common/Breakpoint";
import { useInstance } from "@revolt/instance";

import { useDesignMotion } from "../NameplateMotion";
import {
  communityFileUrl,
  communityStillUrl,
  isCommunityRef,
} from "../userStyle";

import { frameBorderImage } from "./communityFrame";
import { frameRoomOf } from "./frameRoom";

/**
 * The frame around a whole profile card. Put it inside a box that is the
 * card's size and `position: relative` (`FramedCard` does this), next to the
 * card rather than in it: the card clips what overflows it, and the frame
 * reaches past its edges.
 *
 * Every frame is a creator's picture (`c:<id>`); any other value, such as a
 * built-in frame Zrzur no longer ships, draws nothing.
 *
 * It never takes a click or a scroll (`pointer-events: none`), is hidden from
 * screen readers, and adds nothing to the layout. On a phone it may reach past
 * the sheet's top and sides like the card's own popout does on a desktop.
 */
export function ProfileFrame(props: {
  /** `c:<id>` of a community frame */
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

  // a creator's frame may move: anyone who sees no motion (reduced motion,
  // Save data, effects off) gets the media server's still of it, and the
  // moving file is never fetched
  const communityUrl = () =>
    isCommunityRef(props.frame)
      ? (props.url ??
        (motion()
          ? communityFileUrl(instance.mediaUrl, props.file)
          : communityStillUrl(instance.mediaUrl, props.file)))
      : undefined;

  return (
    <Layer
      ref={layer}
      aria-hidden="true"
      data-profile-frame={props.frame ?? ""}
      data-phone={phone() ? "" : undefined}
    >
      <Show when={size() && communityUrl()}>
        {(url) => <Picture style={frameBorderImage(url(), size()!.w)} />}
      </Show>
    </Layer>
  );
}

/**
 * A box the size of the card that also holds its frame. The card goes in as
 * the child; nothing about its own layout changes.
 *
 * With `fit` (a profile shown in the window: the card beside a name, the full
 * profile) the box says the room its frame takes round it, so the profile can
 * be sized and placed with the whole frame on screen:
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
  let host!: HTMLDivElement;

  onMount(() => {
    if (!props.fit) return;
    const measure = () => setWidth(host.clientWidth);
    measure();
    window.addEventListener("resize", measure);
    onCleanup(() => window.removeEventListener("resize", measure));
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    onCleanup(() => observer.disconnect());
  });

  // only a creator's frame is drawn; any other value is no frame at all
  const frame = () => (isCommunityRef(props.frame) ? props.frame : undefined);
  const room = () =>
    props.fit && frame() ? frameRoomOf(frame(), width()) : undefined;
  const px = (n: number) => `${Math.ceil(n)}px`;

  return (
    <Host
      ref={host}
      class={props.class}
      data-frame-host
      data-framed={frame() ? "" : undefined}
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
      <Show when={frame()}>
        <ProfileFrame
          frame={frame()}
          file={props.file}
          url={props.url}
          phone={props.phone}
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

const Picture = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    borderWidth: 0,
  },
});
