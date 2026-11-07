import { For } from "solid-js";

/**
 * Hand-drawn touches for the premium screens: outline feathers drifting
 * behind a header, and a wavy white line where two colours meet. Plain
 * strokes on purpose, so the screens read as drawn, not generated.
 */

/** one outline feather (vane + shaft + two barbs), 24 units tall */
const FEATHER =
  "M20.6 2.6c-5.9-.4-11.6 3.3-13.5 9.6l-1.5 5 2.3-.7c.4-1.3 1.1-2.6 2-3.6l-1 3.2c6.2-.3 10.9-4.9 11.9-11 .2-1.4-.1-2.3-.2-2.5Z M3.4 20.6 15.8 8.2 M14.6 9.6 18 8.3 M12.2 12.9l3.6-.9";

/**
 * where the feathers float: x%, y%, size px, rotation, opacity. They keep
 * to the top and the outer edges, clear of titles and progress lines.
 */
const DRIFT: [number, number, number, number, number][] = [
  [5, 12, 34, -18, 0.5],
  [3, 46, 18, 24, 0.3],
  [28, 6, 14, 60, 0.3],
  [72, 8, 26, 12, 0.45],
  [89, 30, 30, -32, 0.4],
  [84, 4, 14, -60, 0.35],
  [1, 74, 20, 40, 0.3],
  [96, 88, 16, -70, 0.3],
];

/**
 * Outline feathers scattered over a header (absolute, fills its parent)
 */
export function FeatherField(props: {
  color?: string;
  /** keep to the right half, for headers whose text sits on the left */
  endOnly?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        "pointer-events": "none",
        "z-index": "-1",
      }}
    >
      <For each={props.endOnly ? DRIFT.filter(([x]) => x >= 45) : DRIFT}>
        {([x, y, size, rotate, opacity]) => (
          <svg
            x={`${x}%`}
            y={`${y}%`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            overflow="visible"
          >
            <path
              d={FEATHER}
              fill="none"
              stroke={props.color ?? "#fff"}
              stroke-width={1.1}
              stroke-linecap="round"
              stroke-linejoin="round"
              opacity={opacity}
              transform={`rotate(${rotate} 12 12)`}
            />
          </svg>
        )}
      </For>
    </svg>
  );
}

/**
 * A wavy edge between two colours: fills with `fill` below the wave and
 * draws a white line along it. Pinned to the bottom of a positioned
 * header, so the header ends in a wave instead of a straight cut.
 */
export function WaveEdge(props: {
  fill: string;
  height?: number;
  /** how strong the white line is, 0 to 1 */
  line?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 40"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: "0",
        bottom: "-1px",
        display: "block",
        width: "100%",
        height: `${props.height ?? 34}px`,
        "pointer-events": "none",
      }}
    >
      <path
        d="M0 18 C 90 4, 170 30, 260 18 S 430 2, 520 16 S 590 26, 600 20 L600 40 L0 40 Z"
        style={{ fill: props.fill }}
      />
      <path
        d="M0 18 C 90 4, 170 30, 260 18 S 430 2, 520 16 S 590 26, 600 20"
        fill="none"
        stroke="#fff"
        stroke-width="1.6"
        vector-effect="non-scaling-stroke"
        opacity={props.line ?? 0.9}
      />
    </svg>
  );
}
