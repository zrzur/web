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
}) {
  const client = useClient();
  const [failed, setFailed] = createSignal(false);
  const src = () =>
    failed() ? undefined : steamImage(client(), props.url);
  const letter = () => Array.from(props.name.trim())[0]?.toUpperCase() ?? "?";

  return (
    <Box
      data-wide={props.wide ? "" : undefined}
      data-round={props.round ? "" : undefined}
      style={
        props.wide
          ? undefined
          : { width: `${props.size ?? 32}px`, height: `${props.size ?? 32}px` }
      }
      aria-hidden="true"
    >
      <Show
        when={src()}
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
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",

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

const Letter = styled("span", {
  base: {
    fontWeight: 600,
    lineHeight: 1,
  },
});
