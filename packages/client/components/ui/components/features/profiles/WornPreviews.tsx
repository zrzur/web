import { type JSX, Show, createSignal, onCleanup, onMount } from "solid-js";

import { styled } from "styled-system/jsx";

import { useInstance } from "@revolt/instance";

import { Avatar } from "../../design";

import { AvatarDecoration } from "./AvatarDecoration";
import { useDesignMotion } from "./NameplateMotion";
import { ProfileEffect } from "./effects/ProfileEffect";
import { EFFECT_DURATION_MS } from "./effects/effectIds";
import { FramedCard } from "./frames/ProfileFrame";
import { frameRoomOf } from "./frames/frameRoom";
import { profileNameStyle } from "./profileNameStyle";
import {
  type UserStyle,
  hasOwnNameColour,
  isCommunityRef,
  nameStyle,
  nameplateBackground,
  themeColours,
} from "./userStyle";
import { effectStillUrl } from "./userStyleExtras";

/*
 * Each design someone wears, drawn as it really looks on them: the plate
 * behind their own name as in the member list, the decoration on their own
 * avatar, the effect playing over a piece of their card, the frame round a
 * small copy of their card, the name in its own font and colours. All of it
 * is a picture inside a tile button: nothing here takes a click or a focus.
 */

/** Who wears the designs: their real name and avatar */
export type Wearer = { name: string; avatar?: string };

/** The width of a box, once it has one, kept up to date */
function useWidth() {
  const [width, setWidth] = createSignal(0);
  const ref = (el: HTMLElement) => {
    onMount(() => {
      setWidth(el.clientWidth);
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(() => setWidth(el.clientWidth));
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  };
  return [width, ref] as const;
}

/**
 * The nameplate as the member list draws it, at the tile's full width: the
 * person's avatar in its decoration and their name on the plate's art, in
 * the plate's ink unless they chose a colour of their own. A community
 * plate's animated file moves whenever this viewer sees motion.
 */
export function WornPlate(props: { look: UserStyle; wearer: Wearer }) {
  const instance = useInstance();
  const motion = useDesignMotion();
  const plate = () =>
    nameplateBackground(props.look, instance.mediaUrl, { moving: motion() });
  const own = () => hasOwnNameColour(props.look);
  return (
    <Plate
      class="z-plate"
      data-worn-plate
      aria-hidden="true"
      style={{ "--plate": plate() }}
    >
      <AvatarDecoration
        decoration={props.look.decoration}
        file={props.look.decoration_file}
        size={40}
      >
        <Avatar
          src={props.wearer.avatar}
          fallback={props.wearer.name}
          size={40}
        />
      </AvatarDecoration>
      <span
        dir="auto"
        data-own-colour={own() || undefined}
        style={nameStyle(props.look, { colour: own(), moving: true })}
      >
        {props.wearer.name}
      </span>
    </Plate>
  );
}

/** The decoration on the person's own avatar, as big as the tile allows */
export function WornDecoration(props: { look: UserStyle; wearer: Wearer }) {
  const [width, ref] = useWidth();
  // the art is 1.5 times the avatar: it stays inside the stage
  const size = () =>
    width()
      ? Math.max(24, Math.min(64, Math.floor(width() / 1.5 / 4) * 4))
      : 40;
  return (
    <Stage ref={ref} data-worn="decoration" aria-hidden="true">
      <AvatarDecoration
        decoration={props.look.decoration}
        file={props.look.decoration_file}
        size={size()}
        live
      >
        <Avatar
          src={props.wearer.avatar}
          fallback={props.wearer.name}
          size={size()}
        />
      </AvatarDecoration>
    </Stage>
  );
}

/**
 * The effect playing over a piece of the person's card, the way it plays on
 * the profile: once when the tile comes into view, and again, over and over,
 * while the pointer or the keyboard rests on the tile (as on the Designs
 * site). At rest, and for anyone who sees no motion, a still of it; with no
 * motion nothing is fetched or drawn but the still.
 */
export function WornEffect(props: { look: UserStyle }) {
  const instance = useInstance();
  const [playing, setPlaying] = createSignal(false);
  const [play, setPlay] = createSignal(0);
  let stage!: HTMLSpanElement;

  onMount(() => {
    let resting = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      clearTimeout(timer);
      setPlaying(true);
      setPlay((n) => n + 1);
      // one play, a breath, then again while someone rests on it
      timer = setTimeout(() => {
        if (resting) start();
        else setPlaying(false);
      }, EFFECT_DURATION_MS + 600);
    };
    const rest = () => {
      if (resting) return;
      resting = true;
      start();
    };
    const leave = () => {
      resting = false;
    };
    const leaveFocus = (event: FocusEvent) => {
      if (!host?.contains(event.relatedTarget as Node | null)) leave();
    };

    // the tile is the button round the stage
    const host = stage.closest("button") ?? stage;
    host.addEventListener("pointerenter", rest);
    host.addEventListener("pointerleave", leave);
    host.addEventListener("focusin", rest);
    host.addEventListener("focusout", leaveFocus);

    let view: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "undefined") start();
    else {
      view = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        view?.disconnect();
        start();
      });
      view.observe(stage);
    }

    onCleanup(() => {
      clearTimeout(timer);
      view?.disconnect();
      host.removeEventListener("pointerenter", rest);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("focusin", rest);
      host.removeEventListener("focusout", leaveFocus);
    });
  });

  const still = () => {
    const url = effectStillUrl(instance.mediaUrl, props.look.effect_file);
    return (
      <Show when={url}>
        <StillPicture
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          draggable={false}
        />
      </Show>
    );
  };

  return (
    <Stage ref={stage} data-worn="effect" data-window="" aria-hidden="true">
      <ProfileEffect
        effect={playing() ? props.look.effect : undefined}
        file={props.look.effect_file}
        play={play()}
        idle={still()}
      />
    </Stage>
  );
}

/** The width of the small card a frame goes round */
const MINI_CARD = 180;

/**
 * The frame round a small copy of the person's card (their banner, their
 * avatar in its decoration, their name), the whole of it shrunk to fit the
 * tile. A moving frame moves when this viewer sees motion.
 */
export function WornFrame(props: {
  look: UserStyle;
  wearer: Wearer;
  /** the person's banner, when their profile has one */
  banner?: string;
}) {
  const [width, ref] = useWidth();
  const [tall, setTall] = createSignal(0);
  const room = () => frameRoomOf(props.look.profile_frame, MINI_CARD);
  const natural = () => MINI_CARD + 2 * room().x;
  const naturalTall = () => tall() + room().top + room().bottom;
  // fits the square stage both ways
  const scale = () =>
    width() && tall()
      ? Math.min(width() / natural(), width() / naturalTall())
      : 0;
  const banner = (): JSX.CSSProperties => {
    if (props.banner) return { "background-image": `url("${props.banner}")` };
    const theme = themeColours(props.look);
    return theme ? { "background-color": theme.top } : {};
  };

  let card!: HTMLDivElement;
  onMount(() => {
    setTall(card.offsetHeight);
  });

  return (
    <Stage ref={ref} data-worn="frame" aria-hidden="true">
      <MiniHolder
        ref={(el: HTMLDivElement) => onMount(() => (el.inert = true))}
        style={{
          width: `${natural()}px`,
          padding: `${room().top}px ${room().x}px ${room().bottom}px`,
          transform: `translate(-50%, -50%) scale(${scale()})`,
          visibility: scale() ? undefined : "hidden",
        }}
      >
        <FramedCard
          frame={props.look.profile_frame}
          file={props.look.profile_frame_file}
          phone={false}
        >
          <MiniCard ref={card}>
            <MiniBanner style={banner()} />
            <MiniBody>
              <MiniAvatar>
                <AvatarDecoration
                  decoration={props.look.decoration}
                  file={props.look.decoration_file}
                  size={48}
                >
                  <Avatar
                    src={props.wearer.avatar}
                    fallback={props.wearer.name}
                    size={48}
                  />
                </AvatarDecoration>
              </MiniAvatar>
              <strong dir="auto" style={profileNameStyle(props.look)}>
                {props.wearer.name}
              </strong>
              <i />
              <i data-short />
            </MiniBody>
          </MiniCard>
        </FramedCard>
      </MiniHolder>
    </Stage>
  );
}

/** The name in its own font, colours and effect, as the profile draws it */
export function WornName(props: { look: UserStyle; wearer: Wearer }) {
  return (
    <Stage data-worn="name" aria-hidden="true">
      <Word dir="auto" style={profileNameStyle(props.look)}>
        {props.wearer.name}
      </Word>
    </Stage>
  );
}

/** Whether a style has a name style worth a tile of its own */
export const wearsNameStyle = (style: UserStyle | undefined) =>
  !!style &&
  ((!!style.name_font && style.name_font !== "default") ||
    !!style.name_effect ||
    !!style.name_colour?.length);

/** A community design's page, or the built-in one's */
export const communityId = (ref: string | undefined) =>
  isCommunityRef(ref) ? ref!.slice(2) : undefined;

/** The square every square design is drawn in */
const Stage = styled("span", {
  base: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "100%",
    aspectRatio: "1 / 1",
    minWidth: 0,
    containerType: "inline-size",
    // an effect plays in a window onto the card's own surface
    "&[data-window]": {
      overflow: "hidden",
      borderRadius: "var(--z-radius-sm, 6px)",
      background:
        "var(--profile-surface, var(--z-bg-popover, var(--z-bg-raised)))",
    },
  },
});

const StillPicture = styled("img", {
  base: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
});

/** The plate at its real shape (448 by 84), never cropped */
const Plate = styled("span", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    aspectRatio: "448 / 84",
    boxSizing: "border-box",
    paddingInline: "12px",
    borderRadius: "var(--z-radius, 10px)",
    fontSize: "15px",
    lineHeight: "20px",
    fontWeight: 600,
    textAlign: "start",
    "& > span:last-child": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    // the member list's ink: readable on the page and on the art alike
    "& > span:last-child:not([data-own-colour])": {
      color: "var(--z-plate-ink, #fff)",
      WebkitTextFillColor: "var(--z-plate-ink, #fff)",
      textShadow:
        "var(--z-plate-ink-halo, 0 0 2px rgb(0 0 0 / 60%), 0 1px 4px rgb(0 0 0 / 70%))",
    },
  },
});

/** Centred in the stage in either direction; the card keeps the app's own */
const MiniHolder = styled("div", {
  base: {
    position: "absolute",
    top: "50%",
    left: "50%",
    boxSizing: "border-box",
    transformOrigin: "center",
    pointerEvents: "none",
  },
});

/** The profile card's surface, corners and edge, at half its width */
const MiniCard = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: `${MINI_CARD}px`,
    overflow: "hidden",
    color: "var(--profile-ink, var(--z-fg-primary))",
    background: "var(--profile-surface, var(--z-popover-bg))",
    border: "1px solid var(--z-popover-border)",
    borderRadius: "10px",
  },
});

const MiniBanner = styled("div", {
  base: {
    height: "64px",
    backgroundColor: "var(--profile-panel, var(--z-bg-raised))",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
});

const MiniBody = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "0 12px 16px",
    "& strong": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "15px",
      lineHeight: "20px",
      fontWeight: 700,
    },
    // the lines of the profile, as bars: words this small could not be read
    "& i": {
      display: "block",
      height: "8px",
      width: "100%",
      borderRadius: "4px",
      background: "var(--profile-line, var(--z-border-subtle))",
    },
    "& i[data-short]": { width: "60%" },
  },
});

const MiniAvatar = styled("div", {
  base: {
    marginTop: "-28px",
    width: "56px",
    height: "56px",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "var(--profile-surface, var(--z-popover-bg))",
  },
});

const Word = styled("span", {
  base: {
    maxWidth: "100%",
    paddingInline: "4px",
    boxSizing: "border-box",
    textAlign: "center",
    // as big as the stage allows, never past 22 px
    fontSize: "clamp(12px, 18cqi, 22px)",
    lineHeight: 1.25,
    fontWeight: 700,
    overflowWrap: "anywhere",
    lineClamp: 2,
    color: "var(--profile-ink, var(--z-fg-primary))",
  },
});
