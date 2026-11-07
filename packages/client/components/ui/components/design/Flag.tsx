import { For, JSX, Show } from "solid-js";

import { styled } from "styled-system/jsx";

/*
 * Small flag markers for the language picker. Each is a simplified 3:2
 * drawing made for ~20px display (coats of arms reduced to a plain shape),
 * so they stay recognisable without bundling a third-party flag set.
 * Flags are visual markers only: languages are identified by their name.
 */

const W = 30;
const H = 20;

/** Points of a five-pointed star */
function star(cx: number, cy: number, r: number, rotate = 0) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? r * 0.4 : r;
    const a = (Math.PI / 5) * i - Math.PI / 2 + rotate;
    pts.push(
      `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`,
    );
  }
  return pts.join(" ");
}

const hStripes = (colors: string[], weights?: number[]) => {
  const w = weights ?? colors.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  let y = 0;
  return colors.map((fill, i) => {
    const h = (H * w[i]) / total;
    const rect = <rect x="0" y={y} width={W} height={h + 0.05} fill={fill} />;
    y += h;
    return rect;
  });
};

const vStripes = (colors: string[]) =>
  colors.map((fill, i) => (
    <rect
      x={(W / colors.length) * i}
      y="0"
      width={W / colors.length + 0.05}
      height={H}
      fill={fill}
    />
  ));

/** Nordic cross, offset towards the hoist */
const nordic = (bg: string, outer: string, inner?: string) => (
  <>
    <rect width={W} height={H} fill={bg} />
    <rect x="8" y="0" width="5" height={H} fill={outer} />
    <rect x="0" y="7.5" width={W} height="5" fill={outer} />
    <Show when={inner}>
      <rect x="9.25" y="0" width="2.5" height={H} fill={inner} />
      <rect x="0" y="8.75" width={W} height="2.5" fill={inner} />
    </Show>
  </>
);

/** White crescent and star on a coloured field */
const crescent = (bg: string, cx: number, cy: number, r: number) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill="#fff" />
    <circle cx={cx + r * 0.25} cy={cy} r={r * 0.8} fill={bg} />
    <polygon points={star(cx + r * 1.05, cy, r * 0.45, -0.3)} fill="#fff" />
  </>
);

const FLAGS: Record<string, () => JSX.Element> = {
  // United Kingdom
  GB: () => (
    <>
      <rect width={W} height={H} fill="#012169" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" stroke-width="4" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" stroke-width="1.4" />
      <path d="M15,0 V20 M0,10 H30" stroke="#fff" stroke-width="6" />
      <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" stroke-width="3.4" />
    </>
  ),
  // United States
  US: () => (
    <>
      {hStripes(
        Array.from({ length: 13 }, (_, i) => (i % 2 ? "#fff" : "#B22234")),
      )}
      <rect width="13" height="10.77" fill="#3C3B6E" />
      <For each={[2, 5, 8]}>
        {(y) => (
          <For each={[2, 5, 8, 11]}>
            {(x) => <circle cx={x} cy={y + 0.4} r="0.7" fill="#fff" />}
          </For>
        )}
      </For>
    </>
  ),
  // Syria (current official flag)
  SY: () => (
    <>
      {hStripes(["#007A3D", "#fff", "#000"])}
      <polygon points={star(9, 10, 2.6)} fill="#CE1126" />
      <polygon points={star(15, 10, 2.6)} fill="#CE1126" />
      <polygon points={star(21, 10, 2.6)} fill="#CE1126" />
    </>
  ),
  IN: () => (
    <>
      {hStripes(["#FF9933", "#fff", "#138808"])}
      <circle
        cx="15"
        cy="10"
        r="2.6"
        fill="none"
        stroke="#000080"
        stroke-width="0.7"
      />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </>
  ),
  AZ: () => (
    <>
      {hStripes(["#00B5E2", "#EF3340", "#509E2F"])}
      {crescent("#EF3340", 14, 10, 2.6)}
    </>
  ),
  BY: () => (
    <>
      {hStripes(["#C8313E", "#4AA657"], [2, 1])}
      <rect width="4" height={H} fill="#fff" />
      <For each={[2, 6, 10, 14, 18]}>
        {(y) => (
          <polygon
            points={`2,${y - 1.6} 3.4,${y} 2,${y + 1.6} 0.6,${y}`}
            fill="#C8313E"
          />
        )}
      </For>
    </>
  ),
  BG: () => <>{hStripes(["#fff", "#00966E", "#D62612"])}</>,
  BD: () => (
    <>
      <rect width={W} height={H} fill="#006A4E" />
      <circle cx="13.5" cy="10" r="5.5" fill="#F42A41" />
    </>
  ),
  ES: () => (
    <>
      {hStripes(["#AA151B", "#F1BF00", "#AA151B"], [1, 2, 1])}
      <rect x="7" y="7.5" width="3.2" height="5" rx="0.8" fill="#AA151B" />
    </>
  ),
  PH: () => (
    <>
      {hStripes(["#0038A8", "#CE1126"])}
      <polygon points="0,0 17.3,10 0,20" fill="#fff" />
      <circle cx="6" cy="10" r="2.2" fill="#FCD116" />
    </>
  ),
  CZ: () => (
    <>
      {hStripes(["#fff", "#D7141A"])}
      <polygon points="0,0 15,10 0,20" fill="#11457E" />
    </>
  ),
  DK: () => nordic("#C8102E", "#fff"),
  DE: () => <>{hStripes(["#000", "#DD0000", "#FFCE00"])}</>,
  GR: () => (
    <>
      {hStripes(
        Array.from({ length: 9 }, (_, i) => (i % 2 ? "#fff" : "#0D5EAF")),
      )}
      <rect width="11.1" height="11.1" fill="#0D5EAF" />
      <rect x="4.44" width="2.22" height="11.1" fill="#fff" />
      <rect y="4.44" width="11.1" height="2.22" fill="#fff" />
    </>
  ),
  EE: () => <>{hStripes(["#0072CE", "#000", "#fff"])}</>,
  FI: () => nordic("#fff", "#002F6C"),
  FR: () => <>{vStripes(["#002654", "#fff", "#CE1126"])}</>,
  IE: () => <>{vStripes(["#169B62", "#fff", "#FF883E"])}</>,
  HR: () => (
    <>
      {hStripes(["#FF0000", "#fff", "#171796"])}
      <rect
        x="12.5"
        y="5.5"
        width="5"
        height="6"
        fill="#fff"
        stroke="#FF0000"
        stroke-width="0.4"
      />
      {/* checkerboard shield: red squares on the even diagonals */}
      <For each={[0, 1, 2, 3, 4]}>
        {(i) => (
          <For each={[0, 1, 2, 3, 4, 5].filter((j) => (i + j) % 2 === 0)}>
            {(j) => (
              <rect
                x={12.5 + i}
                y={5.5 + j}
                width="1"
                height="1"
                fill="#FF0000"
              />
            )}
          </For>
        )}
      </For>
    </>
  ),
  HU: () => <>{hStripes(["#CD2A3E", "#fff", "#436F4D"])}</>,
  AM: () => <>{hStripes(["#D90012", "#0033A0", "#F2A800"])}</>,
  ID: () => <>{hStripes(["#CE1126", "#fff"])}</>,
  IS: () => nordic("#02529C", "#fff", "#DC1E35"),
  IT: () => <>{vStripes(["#009246", "#fff", "#CE2B37"])}</>,
  JP: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#BC002D" />
    </>
  ),
  KR: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx="15" cy="10" r="5" fill="#003478" />
      <path
        d="M10,10 a5,5 0 0,1 10,0 a2.5,2.5 0 0,1 -5,0 a2.5,2.5 0 0,0 -5,0"
        fill="#C60C30"
      />
      <g stroke="#000" stroke-width="0.9">
        <path d="M4,3.4 l3,-2 M4.6,4.4 l3,-2 M5.2,5.4 l3,-2" />
        <path d="M22,1.4 l3,2 M21.4,2.4 l3,2 M20.8,3.4 l3,2" />
        <path d="M4,16.6 l3,2 M4.6,15.6 l3,2 M5.2,14.6 l3,2" />
        <path d="M22,18.6 l3,-2 M21.4,17.6 l3,-2 M20.8,16.6 l3,-2" />
      </g>
    </>
  ),
  LU: () => <>{hStripes(["#ED2939", "#fff", "#00A1DE"])}</>,
  LT: () => <>{hStripes(["#FDB913", "#006A44", "#C1272D"])}</>,
  LV: () => <>{hStripes(["#9E3039", "#fff", "#9E3039"], [2, 1, 2])}</>,
  MK: () => (
    <>
      <rect width={W} height={H} fill="#D20000" />
      <g stroke="#FFE600" stroke-width="2.2">
        <path d="M15,10 L0,0 M15,10 L30,0 M15,10 L0,20 M15,10 L30,20" />
        <path d="M15,10 L15,0 M15,10 L15,20 M15,10 L0,10 M15,10 L30,10" />
      </g>
      <circle
        cx="15"
        cy="10"
        r="3.4"
        fill="#FFE600"
        stroke="#D20000"
        stroke-width="0.8"
      />
    </>
  ),
  MY: () => (
    <>
      {hStripes(
        Array.from({ length: 14 }, (_, i) => (i % 2 ? "#fff" : "#CC0001")),
      )}
      <rect width="15" height="11.43" fill="#010066" />
      <circle cx="6" cy="5.7" r="3.6" fill="#FFCC00" />
      <circle cx="7.1" cy="5.7" r="3" fill="#010066" />
      <polygon points={star(11, 5.7, 2.4)} fill="#FFCC00" />
    </>
  ),
  NO: () => nordic("#BA0C2F", "#fff", "#00205B"),
  NL: () => <>{hStripes(["#AE1C28", "#fff", "#21468B"])}</>,
  IR: () => (
    <>
      {hStripes(["#239F40", "#fff", "#DA0000"])}
      <circle
        cx="15"
        cy="10"
        r="2.2"
        fill="none"
        stroke="#DA0000"
        stroke-width="0.9"
      />
    </>
  ),
  PL: () => <>{hStripes(["#fff", "#DC143C"])}</>,
  BR: () => (
    <>
      <rect width={W} height={H} fill="#009C3B" />
      <polygon points="15,2 27.5,10 15,18 2.5,10" fill="#FFDF00" />
      <circle cx="15" cy="10" r="4.6" fill="#002776" />
      <path
        d="M10.6,9.2 q4.6,-1.6 8.8,1.6"
        stroke="#fff"
        stroke-width="0.8"
        fill="none"
      />
    </>
  ),
  PT: () => (
    <>
      <rect width="12" height={H} fill="#046A38" />
      <rect x="12" width="18" height={H} fill="#DA291C" />
      <circle cx="12" cy="10" r="3.6" fill="#FFE900" />
      <rect
        x="10.6"
        y="8.2"
        width="2.8"
        height="3.6"
        rx="0.6"
        fill="#fff"
        stroke="#DA291C"
        stroke-width="0.5"
      />
    </>
  ),
  RO: () => <>{vStripes(["#002B7F", "#FCD116", "#CE1126"])}</>,
  RU: () => <>{hStripes(["#fff", "#0039A6", "#D52B1E"])}</>,
  SK: () => (
    <>
      {hStripes(["#fff", "#0B4EA2", "#EE1C25"])}
      <path
        d="M7,4.5 h7 v6.5 q0,4 -3.5,5.5 q-3.5,-1.5 -3.5,-5.5 z"
        fill="#EE1C25"
        stroke="#fff"
        stroke-width="0.7"
      />
      <path
        d="M10.5,6 v8 M8.6,8.4 h3.8 M8.9,10.6 h3.2"
        stroke="#fff"
        stroke-width="0.9"
      />
    </>
  ),
  SI: () => (
    <>
      {hStripes(["#fff", "#005DA4", "#ED1C24"])}
      <path
        d="M6,3.5 h5 v4.5 q0,3 -2.5,4 q-2.5,-1 -2.5,-4 z"
        fill="#005DA4"
        stroke="#ED1C24"
        stroke-width="0.5"
      />
      <path
        d="M6.6,9.4 l1.9,-2.4 l1.9,2.4"
        stroke="#fff"
        stroke-width="0.7"
        fill="none"
      />
    </>
  ),
  AL: () => (
    <>
      <rect width={W} height={H} fill="#E41E20" />
      <path
        d="M15,4 l2,2 l3,-1 l-1,3 l2,2 l-3,0.5 l-1,3.5 l-2,-2 l-2,2 l-1,-3.5 l-3,-0.5 l2,-2 l-1,-3 l3,1 z"
        fill="#000"
      />
    </>
  ),
  RS: () => (
    <>
      {hStripes(["#C6363C", "#0C4076", "#fff"])}
      <path
        d="M8,5 h5 v5.5 q0,3 -2.5,4 q-2.5,-1 -2.5,-4 z"
        fill="#C6363C"
        stroke="#EDB92E"
        stroke-width="0.6"
      />
    </>
  ),
  LK: () => (
    <>
      <rect width={W} height={H} fill="#FFBE29" />
      <rect x="1.2" y="1.2" width="3.6" height="17.6" fill="#00534E" />
      <rect x="4.8" y="1.2" width="3.6" height="17.6" fill="#EB7400" />
      <rect x="9.6" y="1.2" width="19.2" height="17.6" fill="#8D153A" />
      <rect x="15.6" y="6.5" width="7.2" height="7" rx="1.5" fill="#FFBE29" />
    </>
  ),
  SE: () => nordic("#006AA7", "#FECC02"),
  TH: () => (
    <>
      {hStripes(
        ["#A51931", "#F4F5F8", "#2D2A4A", "#F4F5F8", "#A51931"],
        [1, 1, 2, 1, 1],
      )}
    </>
  ),
  TR: () => (
    <>
      <rect width={W} height={H} fill="#E30A17" />
      {crescent("#E30A17", 11.5, 10, 5)}
    </>
  ),
  PK: () => (
    <>
      <rect width={W} height={H} fill="#01411C" />
      <rect width="7.5" height={H} fill="#fff" />
      {crescent("#01411C", 17.5, 10, 4.6)}
    </>
  ),
  UA: () => <>{hStripes(["#0057B7", "#FFD700"])}</>,
  VN: () => (
    <>
      <rect width={W} height={H} fill="#DA251D" />
      <polygon points={star(15, 10.4, 6)} fill="#FFFF00" />
    </>
  ),
  CN: () => (
    <>
      <rect width={W} height={H} fill="#DE2910" />
      <polygon points={star(5, 5, 3)} fill="#FFDE00" />
      <polygon points={star(10, 2, 1)} fill="#FFDE00" />
      <polygon points={star(12, 4, 1)} fill="#FFDE00" />
      <polygon points={star(12, 7, 1)} fill="#FFDE00" />
      <polygon points={star(10, 9, 1)} fill="#FFDE00" />
    </>
  ),
  TW: () => (
    <>
      <rect width={W} height={H} fill="#FE0000" />
      <rect width="15" height="10" fill="#000095" />
      <circle cx="7.5" cy="5" r="2.6" fill="#fff" />
    </>
  ),
};

/**
 * Whether a flag drawing exists for a region code
 * @param code ISO 3166-1 alpha-2 region code
 * @returns Whether `Flag` can draw it
 */
export function hasFlag(code?: string) {
  return !!code && code in FLAGS;
}

/**
 * Flag marker for a region (ISO 3166-1 alpha-2), decorative by default
 */
export function Flag(props: { code: string; width?: number; title?: string }) {
  const width = () => props.width ?? 21;
  return (
    <Show when={FLAGS[props.code]}>
      <Frame
        style={{ width: `${width()}px`, height: `${(width() * 2) / 3}px` }}
        role={props.title ? "img" : undefined}
        aria-label={props.title}
        aria-hidden={props.title ? undefined : "true"}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          {FLAGS[props.code]()}
        </svg>
      </Frame>
    </Show>
  );
}

const Frame = styled("span", {
  base: {
    position: "relative",
    display: "inline-block",
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: "3px",

    "& svg": { display: "block" },

    // hairline so white-heavy flags keep their edge on dark surfaces
    "&::after": {
      content: "''",
      position: "absolute",
      inset: 0,
      borderRadius: "inherit",
      boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.12)",
      pointerEvents: "none",
    },
  },
});
