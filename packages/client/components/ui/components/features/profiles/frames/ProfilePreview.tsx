import { Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

import { useQuery } from "@tanstack/solid-query";
import type { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";

import { Profile } from "..";
import { fetchFullProfile } from "../linkedGames";
import { createProfileTheme } from "../profileTheme";
import { type UserStyle, themeColours } from "../userStyle";

import { FrameGuides } from "./FrameGuides";
import { FramedCard } from "./ProfileFrame";
import { frameRoomOf } from "./frameRoom";

/** The profile card's own width (UserCard) */
const CARD_WIDTH = 360;
/** Tallest the card is shown here; it scrolls in the real one */
const CARD_HEIGHT = 560;

/**
 * Someone's real profile card, as others see it, wearing `style` (a look
 * being tried on, or the frame being chosen), shrunk to fit the space it is
 * given with the frame whole round it. A picture: nothing in it can be
 * clicked or reached with the keyboard.
 */
export function ProfilePreview(props: {
  user: User;
  style: UserStyle;
  /** caps how far it is shrunk when the space is small */
  minScale?: number;
  /**
   * Size it as if it wore this frame: side by side, a card without a frame
   * and cards with one are then drawn at the same size
   */
  sizeAs?: string;
  /**
   * a community frame's picture by address: a file being made in the
   * Creator Studio, not uploaded yet
   */
  frameUrl?: string;
  /** the frame template's guides over the card (Creator Studio) */
  guides?: boolean;
}) {
  const client = useClient();
  const query = useQuery(() => ({
    queryKey: ["profile", props.user.id],
    queryFn: () => fetchFullProfile(client(), props.user),
  }));

  // the same person with the style being shown
  const wearer = createMemo(
    () =>
      new Proxy(props.user, {
        get: (target, key) =>
          key === "style" ? props.style : Reflect.get(target, key, target),
      }) as User,
  );
  const theme = createProfileTheme(
    () => query.data?.bannerURL ?? props.user.avatarURL,
    () => props.user.id,
    () => themeColours(props.style),
  );

  const room = () =>
    frameRoomOf(props.sizeAs ?? props.style.profile_frame, CARD_WIDTH);
  const natural = () => CARD_WIDTH + 2 * room().x;
  const [space, setSpace] = createSignal(natural());
  const [tall, setTall] = createSignal(0);
  const scale = () =>
    Math.max(props.minScale ?? 0, Math.min(1, space() / natural()));

  let outer!: HTMLDivElement;
  let inner!: HTMLDivElement;
  onMount(() => {
    outer.inert = true;
    const measure = () => {
      setSpace(outer.clientWidth);
      setTall(inner.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    onCleanup(() => observer.disconnect());
  });

  return (
    <Outer
      ref={outer}
      aria-hidden="true"
      data-profile-preview
      style={{ height: `${Math.ceil(tall() * scale())}px` }}
    >
      <Inner
        ref={inner}
        style={{
          width: `${natural()}px`,
          padding: `${room().top}px ${room().x}px ${room().bottom}px`,
          transform: `translateX(-50%) scale(${scale()})`,
        }}
      >
        <FramedCard
          frame={props.style.profile_frame}
          file={props.style.profile_frame_file}
          url={props.frameUrl}
          phone={false}
        >
          <Card style={theme()}>
            <Profile.Banner
              size="card"
              user={wearer()}
              bannerUrl={query.data?.animatedBannerURL}
              corner={
                <Profile.CornerActions user={wearer()} onClose={() => {}} />
              }
            />
            <Body>
              <Profile.Identity user={wearer()} size="card" />
              <Profile.Body
                user={wearer()}
                profile={query.data}
                loading={query.isLoading}
                failed={query.isError}
              />
            </Body>
          </Card>
          <Show when={props.guides}>
            <FrameGuides width={CARD_WIDTH} />
          </Show>
        </FramedCard>
      </Inner>
    </Outer>
  );
}

const Outer = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    minWidth: 0,
    pointerEvents: "none",
    userSelect: "none",
  },
});

const Inner = styled("div", {
  base: {
    // centred the same way in either direction: only the box is placed, the
    // card inside keeps the app's direction
    position: "absolute",
    top: 0,
    left: "50%",
    boxSizing: "border-box",
    transformOrigin: "top center",
  },
});

/** The same surface, size and corners as the real card (UserCard) */
const Card = styled("div", {
  base: {
    "--profile-surface": "var(--z-bg-popover, var(--z-bg-raised))",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: `${CARD_WIDTH}px`,
    maxHeight: `${CARD_HEIGHT}px`,
    overflow: "hidden",
    textAlign: "start",
    color: "var(--profile-ink, var(--z-fg-primary))",
    background: "var(--z-popover-bg)",
    border: "1px solid var(--z-popover-border)",
    borderRadius: "14px",
    boxShadow: "var(--z-popover-lift)",
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "4px 16px 12px",
  },
});
