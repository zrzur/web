import { Show, createSignal } from "solid-js";

import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";

import { steamImage } from "./linkedGames";

/**
 * A Steam picture (game icon, header or achievement icon) loaded only
 * through Zrzur's media proxy. Without a picture, or when it fails, the
 * first letter of the name stands in its place.
 */
export function SteamTile(props: {
  url?: string;
  name: string;
  /** Width and height in px; `wide` uses the header shape instead */
  size?: number;
  wide?: boolean;
  round?: boolean;
  /** Takes the size of its grid cell instead of a fixed one */
  fill?: boolean;
  /** An address already through the media proxy (another service's picture) */
  src?: string;
  /**
   * A wide tile without its header (none, or it failed): the game's small
   * icon, drawn large on a blurred copy of itself, before a bare letter
   */
  icon?: string;
}) {
  const client = useClient();
  const [failed, setFailed] = createSignal(false);
  const [iconFailed, setIconFailed] = createSignal(false);
  const src = () =>
    failed() ? undefined : (props.src ?? steamImage(client(), props.url));
  const icon = () =>
    props.wide && !iconFailed() ? steamImage(client(), props.icon) : undefined;
  const letter = () => Array.from(props.name.trim())[0]?.toUpperCase() ?? "?";

  return (
    <Box
      data-wide={props.wide ? "" : undefined}
      data-round={props.round ? "" : undefined}
      data-fill={props.fill ? "" : undefined}
      style={
        props.wide || props.fill
          ? undefined
          : { width: `${props.size ?? 32}px`, height: `${props.size ?? 32}px` }
      }
      aria-hidden="true"
    >
      <Show
        when={src()}
        fallback={
          <Show
            when={icon()}
            fallback={
              <Letter
                style={{
                  "font-size": props.wide
                    ? "28px"
                    : `${Math.round((props.size ?? 32) * 0.45)}px`,
                }}
              >
                {letter()}
              </Letter>
            }
          >
            {(url) => (
              <IconStage>
                <img
                  class="backdrop"
                  src={url()}
                  alt=""
                  referrerPolicy="no-referrer"
                />
                <img
                  class="icon"
                  src={url()}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setIconFailed(true)}
                />
              </IconStage>
            )}
          </Show>
        }
      >
        {(url) => (
          <img
            src={url()}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        )}
      </Show>
    </Box>
  );
}

const Box = styled("span", {
  base: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: "var(--z-radius-sm)",
    // on a themed profile: the same darker tint as its chips
    background: "var(--profile-chip, var(--z-float-tile, var(--z-bg-raised)))",
    color: "var(--profile-ink, var(--z-fg-primary))",

    "&[data-fill]": { width: "100%", height: "100%" },

    "&[data-round]": { borderRadius: "var(--z-radius-pill)" },
    "&[data-wide]": {
      width: "100%",
      aspectRatio: "460 / 215",
      borderRadius: 0,
    },
    "& img": {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    },
  },
});

/** a game's small icon, large, on a blurred copy of itself */
const IconStage = styled("span", {
  base: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    "& .backdrop": {
      position: "absolute",
      inset: "-20%",
      width: "140% !important",
      height: "140% !important",
      objectFit: "cover",
      filter: "blur(18px) saturate(1.4)",
      opacity: 0.55,
    },
    "& .icon": {
      position: "relative",
      width: "64px !important",
      height: "64px !important",
      borderRadius: "var(--z-radius-sm)",
      boxShadow: "0 6px 18px rgb(0 0 0 / 0.45)",
      objectFit: "cover",
    },
  },
});

const Letter = styled("span", {
  base: {
    fontWeight: 600,
    lineHeight: 1,
  },
});
