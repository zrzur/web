import {
  For,
  Index,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { styled } from "styled-system/jsx";

import {
  SKY_HEIGHT,
  SKY_WIDTH,
  skyFlock,
  skyLayers,
  skyPath,
  skyScattered,
} from "./flock";

const COUNT = 200;
const FLOCK = skyFlock(COUNT);
const SCATTERED = skyScattered(COUNT);
const LAYERS = skyLayers(FLOCK);

/** how long the flight in takes, with the last bird's delay */
const FLIGHT = 800;

/** the flock flies in once per visit, wherever it first appears */
let flown = false;

const stillMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The flock: a zrzur never flies alone. Decoration, hidden from screen readers
 * and from the pointer. It flies in once per visit; after that, and with
 * "reduce motion", it is one static drawing that costs nothing to keep.
 *
 * @param props.lit How many birds wear the online colour: one per friend
 * online, so the sky says who is around
 */
export function Sky(props: { lit?: number }) {
  const [drawn, setDrawn] = createSignal(flown || stillMotion());
  const [settled, setSettled] = createSignal(false);

  onMount(() => {
    if (drawn()) return;
    flown = true;
    const frame = requestAnimationFrame(() => setSettled(true));
    const landed = setTimeout(() => setDrawn(true), FLIGHT);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      clearTimeout(landed);
    });
  });

  const birds = createMemo(() => (settled() ? FLOCK : SCATTERED));
  const lit = () => Math.min(props.lit ?? 0, 24);
  // spread through the flock, not bunched at one end
  const isLit = (i: number) => (i * 7) % COUNT < lit();
  const litPath = createMemo(() =>
    skyPath(
      FLOCK.filter((_, i) => isLit(i)).map((bird) => ({
        ...bird,
        r: bird.r + 1.5,
      })),
    ),
  );

  return (
    <Field aria-hidden="true">
      <svg
        viewBox={`0 0 ${SKY_WIDTH} ${SKY_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Show
          when={drawn()}
          fallback={
            <Index each={birds()}>
              {(bird, i) => (
                <path
                  data-flying
                  d={skyPath([{ x: 0, y: 0, r: bird().r }])}
                  style={{
                    transform: `translate(${bird().x}px, ${bird().y}px)`,
                    opacity: bird().o,
                    "transition-delay": `${(i % 24) * 8}ms`,
                  }}
                />
              )}
            </Index>
          }
        >
          <For each={LAYERS}>
            {(layer) => <path d={layer.d} fill-opacity={layer.opacity} />}
          </For>
          <Show when={litPath()}>
            <path d={litPath()} data-lit />
          </Show>
        </Show>
      </svg>
    </Field>
  );
}

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
    "& path[data-flying]": {
      transition:
        "transform 560ms cubic-bezier(0.2, 0, 0, 1), opacity 320ms ease",
      _motionReduce: { transition: "none" },
    },
    "& path[data-lit]": { fill: "var(--z-presence-online)" },
  },
});
