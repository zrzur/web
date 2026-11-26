import { JSX, Show, createSignal } from "solid-js";

import { useInstance } from "@revolt/instance";

import { AvatarDecoratedContext } from "../../design/Avatar";

import { useDesignMotion } from "./NameplateMotion";
import {
  communityFileUrl,
  communityStillUrl,
  isCommunityRef,
} from "./userStyle";

import "./decorations.css";

/**
 * Wraps an avatar and draws the user's chosen decoration around it: artwork
 * 1.5x the avatar, centred on it. Without a decoration it renders the avatar
 * untouched.
 *
 * Every decoration is a creator's picture (`c:<id>`); any other value, such
 * as a built-in decoration Zrzur no longer ships, leaves the avatar as it is.
 *
 * Art is still until the avatar is hovered, or always with `live` (a profile
 * or a preview), so a long list costs nothing and reduced motion or the
 * viewer's setting simply never asks for the moving file (its original).
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

  const community = () => isCommunityRef(props.decoration);
  const src = () =>
    community() ? communityStillUrl(instance.mediaUrl, props.file) : undefined;
  const movingSrc = () =>
    community() ? communityFileUrl(instance.mediaUrl, props.file) : undefined;
  const playing = () =>
    !!movingSrc() && motion() && (hovered() || !!props.live);

  return (
    <Show when={community()} fallback={props.children}>
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
