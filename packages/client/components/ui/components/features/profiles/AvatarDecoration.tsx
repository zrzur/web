import { JSX, Show, createSignal } from "solid-js";

import { useInstance } from "@revolt/instance";

import { AvatarDecoratedContext } from "../../design/Avatar";

import { useDesignMotion } from "./NameplateMotion";
import {
  DECORATIONS,
  communityFileUrl,
  communityStillUrl,
  isCommunityRef,
} from "./userStyle";

import "./decorations.css";

/** URL of a built-in decoration's artwork (public/decorations) */
export const decorationArt = (id: string | undefined) =>
  id && (DECORATIONS as readonly string[]).includes(id)
    ? `${import.meta.env.BASE_URL}decorations/${id}.svg`
    : undefined;

/**
 * Wraps an avatar and draws the user's chosen decoration around it: artwork
 * 1.5x the avatar, centred on it. Without a decoration it renders the avatar
 * untouched.
 *
 * Art is still until the avatar is hovered, or always with `live` (a profile
 * or a preview), so a long list costs nothing and reduced motion or the
 * viewer's setting simply never asks for the moving file. A built-in moves
 * when addressed with `#play`; a community design has its original file.
 */
export function AvatarDecoration(props: {
  decoration?: string;
  /** image of a community decoration (`style.decoration_file`) */
  file?: string;
  /** avatar size in px, so the decoration scales with it */
  size: number;
  /** keeps it moving without a hover */
  live?: boolean;
  children: JSX.Element;
}) {
  const instance = useInstance();
  const motion = useDesignMotion();
  const [hovered, setHovered] = createSignal(false);
  // the moving copy covers the still one only once it has loaded: no blink
  const [moving, setMoving] = createSignal(false);

  const art = () => decorationArt(props.decoration);
  const community = () => isCommunityRef(props.decoration);
  const src = () =>
    community() ? communityStillUrl(instance.mediaUrl, props.file) : art();
  const movingSrc = () =>
    community()
      ? communityFileUrl(instance.mediaUrl, props.file)
      : // its own address (?play): browsers keep one copy of an SVG image per
        // address and ignore the fragment, so after the still file had loaded,
        // `#play` reused it and never started moving
        art() && `${art()}?play#play`;
  const playing = () =>
    !!movingSrc() && motion() && (hovered() || !!props.live);

  return (
    <Show
      when={props.decoration && (art() || isCommunityRef(props.decoration))}
      fallback={props.children}
    >
      <span
        class="z-deco"
        data-deco={props.decoration}
        data-large={props.size >= 64 ? "" : undefined}
        style={{ "--deco-size": `${props.size}px` }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          setHovered(false);
          setMoving(false);
        }}
      >
        <AvatarDecoratedContext.Provider value={true}>
          {props.children}
        </AvatarDecoratedContext.Provider>
        <Show when={src()}>
          {(url) => (
            <img
              class="z-deco-art"
              data-hidden={playing() && moving() ? "" : undefined}
              src={url()}
              alt=""
              aria-hidden="true"
              draggable={false}
              // a long list fetches and decodes only the art near the screen;
              // CSS sizes it (150 %), the numbers only give its shape early
              loading="lazy"
              decoding="async"
              width={Math.round(props.size * 1.5)}
              height={Math.round(props.size * 1.5)}
            />
          )}
        </Show>
        <Show when={playing()}>
          <img
            class="z-deco-art"
            src={movingSrc()}
            alt=""
            aria-hidden="true"
            draggable={false}
            onLoad={() => setMoving(true)}
          />
        </Show>
      </span>
    </Show>
  );
}
