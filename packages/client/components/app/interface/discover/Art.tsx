import { Show, createMemo, createSignal } from "solid-js";

import { styled } from "styled-system/jsx";

import { DiscoverKind } from "./api";
import { hashId, listingArt } from "./artPaths";
import { ART_INK, ART_SKIES } from "./palette";

/**
 * A listing's picture: the banner its owner uploaded or, without one (or if
 * it fails to load), its portrait in birds. Fills its parent.
 */
export function ListingArt(props: {
  kind: DiscoverKind;
  id: string;
  category?: string;
  /** Members, or servers for a bot: how many birds have settled */
  count?: number;
  /** Members online now: the birds in the online colour */
  online?: number;
  /** Address of the uploaded banner */
  banner?: string;
  /** Load at once: only the picture of the most visible card */
  eager?: boolean;
}) {
  const [failed, setFailed] = createSignal(false);
  const paths = createMemo(() =>
    listingArt(props.kind, props.category, props.id, props.count, props.online),
  );

  return (
    <Frame
      aria-hidden="true"
      data-art
      data-kind={props.kind}
      style={{
        "background-color": ART_SKIES[hashId(props.id) % ART_SKIES.length],
        color: ART_INK,
      }}
    >
      <Show
        when={props.banner && !failed()}
        fallback={
          <svg
            // the whole shape, as large as the picture allows
            viewBox="0 4 320 172"
            preserveAspectRatio="xMidYMid meet"
          >
            <path d={paths().perch} data-perch />
            <path d={paths().birds} data-birds />
            <path d={paths().lit} data-lit />
          </svg>
        }
      >
        <img
          src={props.banner}
          alt=""
          loading={props.eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      </Show>
    </Frame>
  );
}

const Frame = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    // the same glow as the top of the page, so a drawn picture belongs to it
    backgroundImage: "var(--dz-glow)",
    "& svg, & img": {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },

    "& path": {
      fill: "none",
      strokeLinecap: "round",
    },
    "& [data-perch]": {
      stroke: "currentColor",
      strokeWidth: 2.5,
      opacity: 0.45,
    },
    "& [data-birds]": { stroke: "currentColor", strokeWidth: 4 },
    "& [data-lit]": { stroke: "var(--z-live)", strokeWidth: 5 },
  },
});
