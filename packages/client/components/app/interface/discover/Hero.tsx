import { For, JSX, Show, createMemo } from "solid-js";

import { styled } from "styled-system/jsx";

import {
  SKY_HEIGHT,
  SKY_WIDTH,
  skyFlock,
  skyLayers,
  skyPath,
} from "@revolt/ui/components/design/flock";

const COUNT = 200;
const FLOCK = skyFlock(COUNT);
const LAYERS = skyLayers(FLOCK);

/**
 * The top of Discover, in the language of Designs: the soft light, the same
 * sky of birds, and the page's title on its lower part. The sky is one static
 * drawing: nothing here moves, so it costs nothing to keep on screen.
 *
 * @param props.lit How many birds wear the online colour
 * @param props.children The title and its line
 */
export function Hero(props: { lit: number; children: JSX.Element }) {
  // spread through the flock, not bunched at one end
  const litPath = createMemo(() =>
    skyPath(
      FLOCK.filter((_, i) => (i * 7) % COUNT < Math.min(props.lit, 24)).map(
        (bird) => ({ ...bird, r: bird.r + 1.5 }),
      ),
    ),
  );

  return (
    <Stage data-hero>
      <Field aria-hidden="true">
        <svg
          viewBox={`0 0 ${SKY_WIDTH} ${SKY_HEIGHT}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <For each={LAYERS}>
            {(layer) => <path d={layer.d} fill-opacity={layer.opacity} />}
          </For>
          <Show when={litPath()}>
            <path d={litPath()} data-lit />
          </Show>
        </svg>
      </Field>
      <Words>{props.children}</Words>
    </Stage>
  );
}

/** Edge to edge of the page, under the bar */
const Stage = styled("section", {
  base: {
    position: "relative",
    width: "100cqw",
    marginInlineStart: "calc(50% - 50cqw)",
    marginBlockStart: "-104px",
    height: "340px",
    isolation: "isolate",
    background: "var(--dz-page)",
    // the light starts at the very top: on the site, behind its header
    "&::before": {
      content: "''",
      position: "absolute",
      zIndex: -1,
      insetInline: 0,
      insetBlock: "calc(var(--dz-under, 0px) * -1) 0",
      background: "var(--dz-glow)",
      pointerEvents: "none",
    },
    "@container (max-width: 599px)": {
      marginBlockStart: "-68px",
      height: "280px",
    },
  },
});

const Field = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    contain: "strict",
    "& svg": {
      display: "block",
      width: "100%",
      height: "100%",
      fill: "var(--z-fg-muted)",
    },
    "& svg:dir(rtl)": { transform: "scaleX(-1)" },
    "& path[data-lit]": { fill: "var(--z-presence-online)" },
  },
});

/** The words stand on the lower part of the sky */
const Words = styled("div", {
  base: {
    position: "absolute",
    insetBlockEnd: "24px",
    insetInline: "max(16px, calc(50cqw - 560px))",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& h1": {
      margin: 0,
      maxWidth: "min(100%, 520px)",
      textWrap: "balance",
      fontSize: "clamp(30px, 3.8cqw, 48px)",
      lineHeight: "1.15",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
      "&:dir(rtl)": { lineHeight: "1.25" },
    },
    "& h1 em": { fontStyle: "normal" },
    "& p": {
      margin: 0,
      maxWidth: "48ch",
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});
