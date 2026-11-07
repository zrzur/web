import { JSX, Show, createUniqueId } from "solid-js";

import { BadgeMeta, BadgeShape } from "./catalog";

/**
 * Original Zrzur badge artwork, drawn inline so it never shifts the
 * layout while loading and needs no third-party files. Only `BadgeMark`
 * uses this; everything else asks `BadgeMark` for a badge.
 *
 * Most badges are emblems with their own silhouette (a shield, a beetle, a
 * flask, a feather…), so each one is recognisable by shape alone at 20px.
 * Badges without an emblem (the team and the top tier) sit on their tier
 * shape with a white glyph. Every badge is lit the same way, so the set
 * reads as one family:
 *   1. the silhouette in a two-stop gradient, lit top-left
 *   2. a soft gloss over the upper half
 *   3. a light inner edge, and a thin dark outline so it holds on light
 *      themes too
 *   4. a ring inside the edge for ringed badges
 *   5. details (white glyphs, cut-outs in the deep colour) on top
 * The whole badge sits on a small shadow.
 */
export function BadgeGlyph(props: { badge: BadgeMeta; size: number }) {
  const id = createUniqueId();
  const top = () => props.badge.colours[0];
  const bottom = () => props.badge.colours[1] ?? props.badge.colours[0];
  const emblem = () => EMBLEMS[props.badge.id];
  const body = () => emblem()?.body ?? SHAPES[props.badge.shape];
  const colours = () => ({ top: top(), deep: bottom() });

  return (
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-badge={props.badge.id}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`zb-${id}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stop-color={top()} />
          <stop offset="1" stop-color={bottom()} />
        </linearGradient>
        <linearGradient id={`zb-${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0.34" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.06" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <linearGradient id={`zb-${id}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0.6" />
          <stop offset="0.6" stop-color="#fff" stop-opacity="0.08" />
        </linearGradient>
        <clipPath id={`zb-${id}-clip`}>
          <path d={body()} />
        </clipPath>
        <filter
          id={`zb-${id}-lift`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="0.6"
            stdDeviation="0.5"
            flood-color="#000"
            flood-opacity="0.35"
          />
        </filter>
      </defs>

      <g filter={`url(#zb-${id}-lift)`}>
        {emblem()?.under?.(colours())}
        <path d={body()} fill={`url(#zb-${id})`} />
      </g>
      <rect
        width="24"
        height="24"
        fill={`url(#zb-${id}-gloss)`}
        clip-path={`url(#zb-${id}-clip)`}
      />
      <path
        d={body()}
        fill="none"
        stroke={`url(#zb-${id}-edge)`}
        stroke-width="1.4"
        clip-path={`url(#zb-${id}-clip)`}
      />
      <path
        d={body()}
        fill="none"
        stroke="#000"
        stroke-opacity="0.28"
        stroke-width="0.6"
      />
      <Show when={props.badge.ring && !emblem()}>
        <path
          d={body()}
          fill="none"
          stroke={props.badge.ring}
          stroke-width="0.9"
          transform="translate(12 12) scale(.84) translate(-12 -12)"
          opacity=".85"
        />
      </Show>
      <Show
        when={emblem()}
        fallback={
          <g
            fill="#fff"
            stroke="#fff"
            stroke-width="0"
            stroke-linecap="round"
            stroke-linejoin="round"
            filter={`url(#zb-${id}-lift)`}
          >
            {GLYPHS[props.badge.id]?.()}
          </g>
        }
      >
        <g stroke-linecap="round" stroke-linejoin="round">
          {emblem()!.details(colours())}
        </g>
      </Show>
    </svg>
  );
}

type Colours = { top: string; deep: string };

/**
 * Emblems: a badge drawn as its own silhouette. `body` is filled with the
 * badge gradient and lit; `under` is drawn beneath it (legs, stems);
 * `details` on top, in white or the deep colour.
 */
type Emblem = {
  body: string;
  under?: (c: Colours) => JSX.Element;
  details: (c: Colours) => JSX.Element;
};

const EMBLEMS: Partial<Record<string, Emblem>> = {
  // a terminal window with a prompt
  developer: {
    body: "M6 3.5h12a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Z",
    details: (c) => (
      <>
        <path d="M2.6 8.2h18.8" stroke={c.deep} stroke-width="1" />
        <circle cx="5.4" cy="6" r=".9" fill="#fff" fill-opacity=".9" />
        <circle cx="8" cy="6" r=".9" fill="#fff" fill-opacity=".7" />
        <circle cx="10.6" cy="6" r=".9" fill="#fff" fill-opacity=".5" />
        <path
          d="m6.6 11.2 3.2 2.6-3.2 2.6M11.6 16.8h5.6"
          fill="none"
          stroke="#fff"
          stroke-width="1.9"
        />
      </>
    ),
  },

  // a shield with a check
  platform_moderator: {
    body: "M12 1.6 20.6 4.9v6.8c0 5.3-3.6 9.1-8.6 10.8-5-1.7-8.6-5.5-8.6-10.8V4.9Z",
    details: (c) => (
      <>
        <path
          d="M12 4.3 18 6.6v5.1c0 3.8-2.4 6.6-6 8"
          fill="none"
          stroke="#fff"
          stroke-opacity=".28"
          stroke-width="1"
        />
        <path
          d="m7.9 12.1 2.8 2.8 5.4-5.6"
          fill="none"
          stroke="#fff"
          stroke-width="2.2"
        />
        <path d="M12 21.2v-.1" stroke={c.deep} stroke-width="0" />
      </>
    ),
  },

  // a medallion with two linked rings
  partner: {
    body: "M12 1.2a10.8 10.8 0 1 1 0 21.6 10.8 10.8 0 0 1 0-21.6Z",
    details: () => (
      <>
        <circle
          cx="12"
          cy="12"
          r="8.9"
          fill="none"
          stroke="#A7DCE6"
          stroke-opacity=".8"
          stroke-width=".8"
        />
        <circle
          cx="9.4"
          cy="12"
          r="3.7"
          fill="none"
          stroke="#fff"
          stroke-width="1.9"
        />
        <circle
          cx="14.6"
          cy="12"
          r="3.7"
          fill="none"
          stroke="#fff"
          stroke-width="1.9"
        />
      </>
    ),
  },

  // a fountain-pen nib
  creator: {
    body: "M12 1.4 19.2 9.6 15.6 19.4H8.4L4.8 9.6Z M8.2 20.2h7.6v1.4a1 1 0 0 1-1 1H9.2a1 1 0 0 1-1-1Z",
    details: (c) => (
      <>
        <path d="M12 12.4v6.4" stroke={c.deep} stroke-width="1.3" />
        <circle cx="12" cy="10.6" r="1.9" fill={c.deep} />
        <circle cx="11.4" cy="10" r=".6" fill="#fff" fill-opacity=".7" />
        <path
          d="M12 3.4 6.9 9.4"
          fill="none"
          stroke="#fff"
          stroke-opacity=".5"
          stroke-width=".9"
        />
      </>
    ),
  },

  // a beetle, legs and antennae beneath the shell
  bug_hunter: {
    body: "M12 7c3.7 0 6 3.1 6 7.4 0 4.5-2.7 8-6 8s-6-3.5-6-8C6 10.1 8.3 7 12 7Z M12 1.9a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8Z",
    under: (c) => (
      <path
        d="M7 11.2 3.4 9.4M6.4 14.8H2.6M7 18.4l-3.3 2M17 11.2l3.6-1.8M17.6 14.8h3.8M17 18.4l3.3 2M10.6 2.6 9 .9M13.4 2.6 15 .9"
        fill="none"
        stroke={c.deep}
        stroke-width="1.5"
        stroke-linecap="round"
      />
    ),
    details: (c) => (
      <>
        <path d="M12 9.4v12.8" stroke={c.deep} stroke-width="1.1" />
        <path d="M6.6 10.6h10.8" stroke={c.deep} stroke-width=".9" />
        <ellipse
          cx="9.4"
          cy="14"
          rx="1.1"
          ry="1.5"
          fill="#fff"
          fill-opacity=".85"
        />
        <ellipse
          cx="14.6"
          cy="14"
          rx="1.1"
          ry="1.5"
          fill="#fff"
          fill-opacity=".85"
        />
        <ellipse
          cx="9.6"
          cy="18.4"
          rx=".8"
          ry="1"
          fill="#fff"
          fill-opacity=".6"
        />
        <ellipse
          cx="14.4"
          cy="18.4"
          rx=".8"
          ry="1"
          fill="#fff"
          fill-opacity=".6"
        />
      </>
    ),
  },

  // a flask, half full, with bubbles
  beta_tester: {
    body: "M8.6 1.6h6.8a.9.9 0 0 1 0 1.8h-.6v5.2l5.8 9.6a2.6 2.6 0 0 1-2.2 4H5.6a2.6 2.6 0 0 1-2.2-4l5.8-9.6V3.4h-.6a.9.9 0 0 1 0-1.8Z",
    details: (c) => (
      <>
        <path
          d="M6.9 14.4h10.2l2.2 3.7a1.4 1.4 0 0 1-1.2 2.1H5.9a1.4 1.4 0 0 1-1.2-2.1Z"
          fill="#fff"
          fill-opacity=".92"
        />
        <circle cx="10.4" cy="17.4" r="1.1" fill={c.top} />
        <circle cx="13.9" cy="16.2" r=".8" fill={c.top} />
        <circle cx="12.6" cy="11.4" r=".9" fill="#fff" fill-opacity=".8" />
        <circle cx="11" cy="8.6" r=".6" fill="#fff" fill-opacity=".6" />
        <path d="M10.2 3.4h3.6" stroke={c.deep} stroke-width=".8" />
      </>
    ),
  },

  // Feather: the feather itself
  plus: {
    body: "M22 1.9c-7.4-.5-14.4 4.1-16.8 12l-1.9 6.3 2.9-.9c.5-1.6 1.4-3.2 2.5-4.5l-1.2 4c7.7-.4 13.6-6.1 14.8-13.7.2-1.8-.2-2.9-.3-3.2Z",
    under: (c) => (
      <path
        d="M1.4 22.6 17.6 6.4"
        fill="none"
        stroke={c.deep}
        stroke-width="1.7"
        stroke-linecap="round"
      />
    ),
    details: () => (
      <>
        <path
          d="M19.4 5.8 21.6 4.6M16.1 9.5 19.6 8M13.2 13.4l3.9-1.1"
          fill="none"
          stroke="#000"
          stroke-opacity=".3"
          stroke-width="1.1"
        />
        <path
          d="M20.2 3.2c-5.4.3-10.3 3.8-12.2 9.3"
          fill="none"
          stroke="#fff"
          stroke-opacity=".6"
          stroke-width="1"
        />
      </>
    ),
  },

  // a heart with a spark
  early_supporter: {
    body: "M12 21.6S1.8 15.6 1.8 8.4A5.3 5.3 0 0 1 12 5.8a5.3 5.3 0 0 1 10.2 2.6c0 7.2-10.2 13.2-10.2 13.2Z",
    details: () => (
      <>
        <path
          d="M5.2 8.2a2.6 2.6 0 0 1 2.6-2.4"
          fill="none"
          stroke="#fff"
          stroke-opacity=".75"
          stroke-width="1.3"
        />
        {sparkle(16.6, 10.2, 2.6)}
      </>
    ),
  },

  // a sprout with two leaves
  early_adopter: {
    body: "M11.6 13.4C11 7.6 7 4.4 1.8 4.6c.2 5.3 3.8 8.9 9.8 8.8Z M12.4 12.4c.4-6.2 4.4-9.8 9.8-9.8 0 5.8-4 9.8-9.8 9.8Z",
    under: (c) => (
      <>
        <path
          d="M12 12v9.4"
          fill="none"
          stroke={c.deep}
          stroke-width="2.1"
          stroke-linecap="round"
        />
        <path
          d="M6.6 21.6h10.8"
          fill="none"
          stroke={c.deep}
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </>
    ),
    details: (c) => (
      <path
        d="M3.8 6.4c2.9.7 5.4 3 7 6.2M20.2 4.6c-3.2 1.2-5.6 3.8-7 7"
        fill="none"
        stroke={c.deep}
        stroke-opacity=".8"
        stroke-width=".9"
      />
    ),
  },

  // a calendar page with a 1
  one_year: {
    body: "M6 2.4h2.6v2h6.8v-2H18v2h1.4a2.4 2.4 0 0 1 2.4 2.4v12.4a2.4 2.4 0 0 1-2.4 2.4H4.6a2.4 2.4 0 0 1-2.4-2.4V6.8a2.4 2.4 0 0 1 2.4-2.4H6Z",
    details: (c) => (
      <>
        <path d="M2.4 8.8h19.2" stroke={c.deep} stroke-width="1" />
        <path
          d="m10 12.6 2.4-1.6v8"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </>
    ),
  },

  // a tree of three tiers, one for each year
  three_years: {
    body: "M12 1.4 17.4 8h-2.6l4 5h-2.6l4.4 5.4h-6.4v4h-4.4v-4H3.4L7.8 13H5.2l4-5H6.6Z",
    details: () => (
      <>
        <circle cx="12" cy="7" r="1.2" fill="#fff" />
        <circle cx="12" cy="11.4" r="1.2" fill="#fff" />
        <circle cx="12" cy="15.8" r="1.2" fill="#fff" />
      </>
    ),
  },

  // a house, the first place people gather
  community_builder: {
    body: "M12 2 22 10.6a1 1 0 0 1-.7 1.8h-1.7v8.2a1.4 1.4 0 0 1-1.4 1.4H5.8a1.4 1.4 0 0 1-1.4-1.4v-8.2H2.7A1 1 0 0 1 2 10.6Z",
    details: () => (
      <path d="M9.6 22v-6a2.4 2.4 0 0 1 4.8 0v6Z" fill="#fff" />
    ),
  },

  // the house became a skyline
  big_community: {
    body: "M2 22V11.4l5-2.4v2.8l4-1.8V3.6L17 2v6.2l5 2V22Z",
    details: () => (
      <path
        d="M4.6 14.4h2.2M4.6 18h2.2M12.6 7h2M12.6 10.6h2M12.6 14.2h2M12.6 17.8h2M18 13.8h1.8M18 17.4h1.8"
        fill="none"
        stroke="#fff"
        stroke-width="1.6"
      />
    ),
  },

  // a key with a check in its bow
  verified_server_owner: {
    body: "M12 1.4a7.2 7.2 0 0 1 2.6 13.9V17h2.6v2.6h-2.6v1.4a1.4 1.4 0 0 1-1.4 1.4h-2.4a1.4 1.4 0 0 1-1.4-1.4v-5.7A7.2 7.2 0 0 1 12 1.4Z",
    details: () => (
      <path
        d="m8.6 8.6 2.4 2.4 4.4-4.6"
        fill="none"
        stroke="#fff"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    ),
  },

  // a robot's head, antenna up
  verified_bot_developer: {
    body: "M11 1.8h2v3.6h3.6A3.6 3.6 0 0 1 20.2 9v1h1.4v6h-1.4v1.8a3.6 3.6 0 0 1-3.6 3.6H7.4a3.6 3.6 0 0 1-3.6-3.6V16H2.4v-6h1.4V9a3.6 3.6 0 0 1 3.6-3.6H11Z",
    details: () => (
      <>
        <circle cx="8.8" cy="11.4" r="1.7" fill="#fff" />
        <circle cx="15.2" cy="11.4" r="1.7" fill="#fff" />
        <path
          d="M8.6 16.4h6.8"
          fill="none"
          stroke="#fff"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </>
    ),
  },

  // a trophy with a 1, first place
  saha_champion: {
    body: "M6.4 2.4h11.2v1.8h3.8v2.6c0 3-1.9 5.2-4.7 5.8a5.9 5.9 0 0 1-3.5 2.9v2.9h3.2a1.2 1.2 0 0 1 1.2 1.2v1.6H6.4v-1.6a1.2 1.2 0 0 1 1.2-1.2h3.2v-2.9a5.9 5.9 0 0 1-3.5-2.9C4.5 12 2.6 9.8 2.6 6.8V4.2h3.8Z",
    details: (c) => (
      <>
        <path
          d="M6.4 6.2H4.8v.6c0 1.5.7 2.7 1.8 3.3a9.6 9.6 0 0 1-.2-2ZM17.6 6.2h1.6v.6c0 1.5-.7 2.7-1.8 3.3.1-.6.2-1.3.2-2Z"
          fill={c.deep}
        />
        <path
          d="m10.8 7.4 1.6-1.2v5.8"
          fill="none"
          stroke="#fff"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </>
    ),
  },

  // an open hand holding a heart
  community_helper: {
    body: "M7.4 12.6V5.4a1.5 1.5 0 0 1 3 0v4.4h.6V3.4a1.5 1.5 0 0 1 3 0v6.4h.6V4.6a1.5 1.5 0 0 1 3 0v5.6h.6V7a1.5 1.5 0 0 1 3 0v8.2c0 4-2.9 7-6.9 7h-1.3c-2.1 0-3.8-.9-5-2.6l-3.9-5.6a1.6 1.6 0 0 1 2.4-2.1Z",
    details: () => (
      <path
        d="M13.8 18.8c-1.7-1-2.8-2-2.8-3.3 0-1 .7-1.7 1.6-1.7.5 0 1 .2 1.2.7.2-.5.7-.7 1.2-.7.9 0 1.6.7 1.6 1.7 0 1.3-1.1 2.3-2.8 3.3Z"
        fill="#fff"
      />
    ),
  },

  // retired: a speech bubble with an "A"
  translator: {
    body: "M5 2.6h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-6.4L7.4 21.8v-4.2H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z",
    details: () => (
      <path
        d="m8.6 14 3.4-8.4 3.4 8.4M9.8 11.2h4.4"
        fill="none"
        stroke="#fff"
        stroke-width="1.8"
      />
    ),
  },

  // retired: a padlock
  responsible_disclosure: {
    body: "M5.6 10.2h12.8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z",
    under: (c) => (
      <path
        d="M7.6 10.6V7.4a4.4 4.4 0 0 1 8.8 0v3.2"
        fill="none"
        stroke={c.deep}
        stroke-width="2.2"
      />
    ),
    details: (c) => (
      <>
        <circle cx="12" cy="15.2" r="1.7" fill={c.deep} />
        <path d="M12 16.2v2.6" stroke={c.deep} stroke-width="1.4" />
      </>
    ),
  },

  // retired: a heart
  supporter: {
    body: "M12 21.6S1.8 15.6 1.8 8.4A5.3 5.3 0 0 1 12 5.8a5.3 5.3 0 0 1 10.2 2.6c0 7.2-10.2 13.2-10.2 13.2Z",
    details: () => (
      <path
        d="M5.2 8.2a2.6 2.6 0 0 1 2.6-2.4"
        fill="none"
        stroke="#fff"
        stroke-opacity=".75"
        stroke-width="1.3"
      />
    ),
  },

  // retired: a paw
  paw: {
    body: "M12 11.4c3.4 0 6.4 3.6 6.4 6.6 0 2.4-1.8 3.6-3.6 3.6-1.2 0-1.8-.6-2.8-.6s-1.6.6-2.8.6c-1.8 0-3.6-1.2-3.6-3.6 0-3 3-6.6 6.4-6.6Z M9 2.6a2.3 2.9 0 1 1 0 5.8 2.3 2.9 0 0 1 0-5.8Z M15 2.6a2.3 2.9 0 1 1 0 5.8 2.3 2.9 0 0 1 0-5.8Z M19.6 6.2a2.3 2.8 0 1 1 0 5.6 2.3 2.8 0 0 1 0-5.6Z M4.4 6.2a2.3 2.8 0 1 1 0 5.6 2.3 2.8 0 0 1 0-5.6Z",
    details: () => <></>,
  },
};

/** Twelve-point rosette for top-tier badges */
function rosette(): string {
  const points: string[] = [];
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * i) / 12 - Math.PI / 2;
    const radius = i % 2 === 0 ? 11.6 : 9.9;
    points.push(
      `${(12 + radius * Math.cos(angle)).toFixed(2)} ${(12 + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

const SHAPES: Record<BadgeShape, string> = {
  square:
    "M8 1.5h8a6.5 6.5 0 0 1 6.5 6.5v8a6.5 6.5 0 0 1-6.5 6.5H8A6.5 6.5 0 0 1 1.5 16V8A6.5 6.5 0 0 1 8 1.5Z",
  hex: "M12 1.2c.5 0 1 .1 1.4.4l7.1 4.1c.9.5 1.4 1.4 1.4 2.4v7.8c0 1-.5 1.9-1.4 2.4l-7.1 4.1c-.9.5-1.9.5-2.8 0l-7.1-4.1c-.9-.5-1.4-1.4-1.4-2.4V8.1c0-1 .5-1.9 1.4-2.4l7.1-4.1c.4-.3.9-.4 1.4-.4Z",
  rosette: rosette(),
  circle: "M12 1a11 11 0 1 1 0 22 11 11 0 0 1 0-22Z",
  gem: "M7.2 2.4h9.6a1.4 1.4 0 0 1 1.1.5l4 4.9a1.4 1.4 0 0 1 0 1.8L13 21.8a1.3 1.3 0 0 1-2 0L1.9 9.6a1.4 1.4 0 0 1 0-1.8l4.2-4.9a1.4 1.4 0 0 1 1.1-.5Z",
  banner:
    "M4.6 1.6h14.8A1.6 1.6 0 0 1 21 3.2v17.6a1 1 0 0 1-1.5.9L12 17.4l-7.5 4.3a1 1 0 0 1-1.5-.9V3.2a1.6 1.6 0 0 1 1.6-1.6Z",
};

const line = (d: string, width = 1.8): JSX.Element => (
  <path d={d} fill="none" stroke-width={width} />
);

const logo = (size: number) => (
  <image
    href={`${import.meta.env.BASE_URL}assets/web/zrzur-mark.svg`}
    x={12 - size / 2}
    y={12 - size / 2}
    width={size}
    height={size}
    preserveAspectRatio="xMidYMid meet"
  />
);

const nib = () => (
  <>
    <path d="M12 5.2 16.6 10l-2.9 7.6h-3.4L7.4 10Z" />
    <path d="M10.3 17.6h3.4v1.4h-3.4z" opacity=".85" />
    <circle cx="12" cy="10.6" r="1.25" fill="#000" fill-opacity=".35" />
    {line("M12 11.9v3", 1.1)}
  </>
);

const beetle = () => (
  <>
    <ellipse cx="12" cy="13.6" rx="3.9" ry="4.7" />
    <circle cx="12" cy="7.9" r="2.1" />
    {line(
      "M8.2 11.4H5.8M8.1 14.6H5.4M15.8 11.4h2.4M15.9 14.6h2.7M10.6 6.4 9.4 4.9M13.4 6.4l1.2-1.5",
      1.4,
    )}
    <path d="M11.5 9.4h1v8.6h-1z" fill="#000" fill-opacity=".3" />
  </>
);

const flask = () => (
  <>
    {line(
      "M9.4 5.2h5.2M10.5 5.4v4.1l-4 6.9a1.7 1.7 0 0 0 1.5 2.6h8a1.7 1.7 0 0 0 1.5-2.6l-4-6.9V5.4",
      1.6,
    )}
    <path d="M8.3 15.6h7.4l1 1.7a.6.6 0 0 1-.5.9H7.8a.6.6 0 0 1-.5-.9Z" />
    <circle cx="12.6" cy="13.2" r=".9" />
    <circle cx="10.9" cy="11.6" r=".6" />
  </>
);

const heart = () => (
  <path d="M12 18.6s-6.4-3.8-6.4-8.4A3.5 3.5 0 0 1 12 8.1a3.5 3.5 0 0 1 6.4 2.1c0 4.6-6.4 8.4-6.4 8.4Z" />
);

const sparkle = (x: number, y: number, r: number) => (
  <path
    fill="#fff"
    d={`M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`}
  />
);

const GLYPHS: Partial<Record<string, () => JSX.Element>> = {
  founder: () => logo(15),
  staff: () => logo(12.5),
  developer: () =>
    line(
      "M9.2 8.2 5.6 12l3.6 3.8M14.8 8.2l3.6 3.8-3.6 3.8M13.1 6.6l-2.2 10.8",
      1.8,
    ),
  platform_moderator: () => (
    <>
      <path d="M12 4.6 17.8 6.8v4.6c0 3.6-2.5 6.1-5.8 7.4-3.3-1.3-5.8-3.8-5.8-7.4V6.8Z" />
      <path
        d="m9.4 11.7 1.9 1.9 3.4-3.6"
        fill="none"
        stroke="rgba(0,0,0,.42)"
        stroke-width="1.7"
      />
    </>
  ),
  partner: () => (
    <>
      <circle cx="9.3" cy="12" r="4.1" fill="none" stroke-width="1.8" />
      <circle cx="14.7" cy="12" r="4.1" fill="none" stroke-width="1.8" />
    </>
  ),
  creator: nib,
  super_creator: () => (
    <>
      <g transform="translate(12 12.6) scale(.86) translate(-12 -12)">
        {nib()}
      </g>
      {sparkle(17.6, 6.4, 2.2)}
      {sparkle(6.6, 7.4, 1.4)}
    </>
  ),
  bug_hunter: beetle,
  elite_bug_hunter: () => (
    <>
      <g transform="translate(12 13) scale(.82) translate(-12 -12)">
        {beetle()}
      </g>
      {line("m8.8 6.4 3.2-2.6 3.2 2.6", 1.7)}
    </>
  ),
  beta_tester: flask,
  beta_veteran: () => (
    <>
      <g transform="translate(12 11.4) scale(.74) translate(-12 -12)">
        {flask()}
      </g>
      {line(
        "M6.2 8.6c-1.4 3.4-.2 7.4 3.3 9.4M17.8 8.6c1.4 3.4.2 7.4-3.3 9.4",
        1.3,
      )}
    </>
  ),
  // Feather: the vane with its shaft, notched like the Feather mark
  plus: () => (
    <g transform="translate(12 12) scale(.72) translate(-12 -12)">
      <path d="M20.6 2.6c-5.9-.4-11.6 3.3-13.5 9.6l-1.5 5 2.3-.7c.4-1.3 1.1-2.6 2-3.6l-1 3.2c6.2-.3 10.9-4.9 11.9-11 .2-1.4-.1-2.3-.2-2.5Z" />
      <path
        d="M17.3 6.6 19.6 5.6M14.6 9.6 18 8.3M12.2 12.9l3.6-.9"
        fill="none"
        stroke="rgba(0,0,0,.35)"
        stroke-width="1"
      />
      <path d="M3.4 20.6 15.8 8.2" fill="none" stroke-width="1.6" />
    </g>
  ),
  early_supporter: () => (
    <>
      {heart()}
      {sparkle(17.8, 6.2, 1.9)}
    </>
  ),
  early_adopter: () => (
    <>
      {line("M12 18.4v-6.6", 1.7)}
      <path d="M12 12.2c-.4-3.1-2.6-4.9-5.8-4.8.1 3 2.3 5 5.8 4.8Z" />
      <path d="M12 11.2c.3-3.4 2.6-5.4 6-5.4 0 3.3-2.4 5.5-6 5.4Z" />
    </>
  ),
  translator: () => (
    <>
      <path d="M6 6.2h12a1.6 1.6 0 0 1 1.6 1.6v6.4a1.6 1.6 0 0 1-1.6 1.6h-6l-3.6 3v-3H6a1.6 1.6 0 0 1-1.6-1.6V7.8A1.6 1.6 0 0 1 6 6.2Z" />
      <path
        d="m9.2 13.4 1.8-4.8 1.8 4.8M9.8 12h2.4M14.2 9.2h2.4"
        fill="none"
        stroke="rgba(0,0,0,.42)"
        stroke-width="1.3"
      />
    </>
  ),
  responsible_disclosure: () => (
    <>
      {line("M8.8 10.6V8.9a3.2 3.2 0 0 1 6.4 0v1.7", 1.8)}
      <rect x="6.8" y="10.4" width="10.4" height="8" rx="2" />
      <circle cx="12" cy="14.4" r="1.3" fill="rgba(0,0,0,.42)" />
    </>
  ),
  supporter: heart,
  paw: () => (
    <>
      <ellipse cx="12" cy="15" rx="3.6" ry="3" />
      <circle cx="7.4" cy="11" r="1.6" />
      <circle cx="10.2" cy="7.9" r="1.6" />
      <circle cx="13.8" cy="7.9" r="1.6" />
      <circle cx="16.6" cy="11" r="1.6" />
    </>
  ),
  server_owner: () => (
    <>
      <path d="M5.6 9.2 9 12l3-5.4 3 5.4 3.4-2.8-1.3 7.6H6.9Z" />
      <path d="M6.9 17.6h10.2v1.5H6.9z" opacity=".85" />
    </>
  ),
  server_official: () => logo(12.5),
  server_verified: () => (
    <path d="m8.4 12.2 2.4 2.4 4.8-5" fill="none" stroke-width="2" />
  ),
  bot_verified: () => (
    <path d="m8.4 12.2 2.4 2.4 4.8-5" fill="none" stroke-width="2" />
  ),
  reserved_1: () => sparkle(12, 12, 6),
  reserved_2: () => sparkle(12, 12, 6),
};
