import type { JSX } from "solid-js";

export type ServerFlowArtName =
  | "scratch"
  | "gaming"
  | "friends"
  | "community"
  | "people";

/** Soft solid shapes, as in the logo, in the two brand colours and on a tile */
const LIGHT = "var(--z-fg-primary, #F0F1F8)";
const ACCENT = "var(--z-accent-fill, #E0195F)";
const TILE = "color-mix(in srgb, var(--z-accent-fill, #E0195F) 22%, transparent)";

/**
 * Small pictures for the create server rows, drawn for Zrzur inline like the
 * badges in BadgeGlyph: no outside files, and the same rounded, solid look as
 * the logo, so they read as part of the app.
 */
const ART: Record<ServerFlowArtName, () => JSX.Element> = {
  // a plus: start with nothing
  scratch: () => (
    <path
      d="M16 8.5a2.2 2.2 0 0 1 2.2 2.2v3.1h3.1a2.2 2.2 0 0 1 0 4.4h-3.1v3.1a2.2 2.2 0 0 1-4.4 0v-3.1h-3.1a2.2 2.2 0 0 1 0-4.4h3.1v-3.1A2.2 2.2 0 0 1 16 8.5Z"
      fill={LIGHT}
    />
  ),
  // a game pad with the logo's outline
  gaming: () => (
    <>
      <path
        d="M11.6 9.5h8.8c1 0 1.9.4 2.6 1.1l3.2 3.4a4.4 4.4 0 0 1 .1 6l-.6.7a3.4 3.4 0 0 1-5 .1L19 19.4a2 2 0 0 0-1.4-.6h-3.2a2 2 0 0 0-1.4.6l-1.8 1.9a3.4 3.4 0 0 1-5-.1l-.6-.7a4.4 4.4 0 0 1 .1-6L9 10.6a3.6 3.6 0 0 1 2.6-1.1Z"
        fill={LIGHT}
      />
      <circle cx="12.2" cy="14.2" r="1.7" fill={ACCENT} />
      <circle cx="19.8" cy="14.2" r="1.7" fill={ACCENT} />
    </>
  ),
  // two people side by side
  friends: () => (
    <>
      <circle cx="20.6" cy="12.4" r="3.4" fill={ACCENT} />
      <path
        d="M14.5 22.8c.6-3.5 2.9-5.6 6.1-5.6 3.2 0 5.5 2.1 6.1 5.6.1.7-.4 1.2-1 1.2H15.5c-.6 0-1.1-.5-1-1.2Z"
        fill={ACCENT}
      />
      <circle cx="12.4" cy="12" r="4" fill={LIGHT} />
      <path
        d="M5.3 22.6c.7-4 3.4-6.4 7.1-6.4s6.4 2.4 7.1 6.4c.1.8-.5 1.4-1.2 1.4H6.5c-.7 0-1.3-.6-1.2-1.4Z"
        fill={LIGHT}
      />
    </>
  ),
  // one person with others around them
  community: () => (
    <>
      <circle cx="8.4" cy="13.2" r="2.9" fill={ACCENT} />
      <circle cx="23.6" cy="13.2" r="2.9" fill={ACCENT} />
      <path
        d="M3.4 22.6c.4-3 2.4-4.8 5-4.8 2.7 0 4.6 1.8 5 4.8.1.7-.4 1.4-1.1 1.4H4.5c-.7 0-1.2-.7-1.1-1.4ZM18.6 22.6c.4-3 2.3-4.8 5-4.8 2.6 0 4.6 1.8 5 4.8.1.7-.4 1.4-1.1 1.4h-7.8c-.7 0-1.2-.7-1.1-1.4Z"
        fill={ACCENT}
      />
      <circle cx="16" cy="11.6" r="3.9" fill={LIGHT} />
      <path
        d="M9.2 23.5c.5-4.1 3.2-6.7 6.8-6.7s6.3 2.6 6.8 6.7c.1.8-.5 1.5-1.3 1.5H10.5c-.8 0-1.4-.7-1.3-1.5Z"
        fill={LIGHT}
      />
    </>
  ),
  // a speech bubble with a heart: just friends
  people: () => (
    <>
      <path
        d="M9.5 7.5h13A4.5 4.5 0 0 1 27 12v7a4.5 4.5 0 0 1-4.5 4.5h-6.3l-4.3 3.3c-.7.5-1.6 0-1.6-.8v-2.5h-.8A4.5 4.5 0 0 1 5 19v-7a4.5 4.5 0 0 1 4.5-4.5Z"
        fill={LIGHT}
      />
      <path
        d="M16 20c-3.1-2.2-5-3.8-5-5.9a2.6 2.6 0 0 1 5-.9 2.6 2.6 0 0 1 5 .9c0 2.1-1.9 3.7-5 5.9Z"
        fill={ACCENT}
      />
    </>
  ),
};

export function ServerFlowArt(props: {
  name: ServerFlowArtName;
  size?: number;
}) {
  return (
    <svg
      width={props.size ?? 32}
      height={props.size ?? 32}
      viewBox="0 0 32 32"
      aria-hidden="true"
      data-flow-art={props.name}
      style={{ "flex-shrink": 0 }}
    >
      <rect width="32" height="32" rx="9" style={{ fill: TILE }} />
      {ART[props.name]()}
    </svg>
  );
}
