import { JSX } from "solid-js";

/**
 * Rules: a solid book cover with the tick cut out, its pages running out of
 * the spine, along the foot and up the side. The one solid glyph among the
 * line icons, so the rules room stands out in the channel list. Drawn for
 * Zrzur (2026-11-01); not taken from any other app's artwork.
 *
 * Coloured exactly like <Icon>: the colour of the text around it, tinted
 * with the Appearance icon colour, unless --z-icon-color sets a role.
 */
export function RulesIcon(props: { size?: number; style?: JSX.CSSProperties }) {
  const size = () => props.size ?? 20;
  return (
    <span
      class="z-icon z-icon--rules"
      data-icon="rules"
      aria-hidden="true"
      style={{
        display: "inline-flex",
        "flex-shrink": 0,
        width: `${size()}px`,
        height: `${size()}px`,
        color:
          "var(--z-icon-color, color-mix(in srgb, currentColor 82%, var(--z-icon-accent, currentColor)))",
        ...props.style,
      }}
    >
      <svg
        width={size()}
        height={size()}
        viewBox="0 0 24 24"
        fill="none"
        style={{ width: "100%", height: "100%" }}
      >
        {/*
          One outline, no seams: the cover, then down the spine into the
          pages, along the foot and up the side; the tick is a hole.
        */}
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M6 2H14A3 3 0 0 1 17 5V14.5A3 3 0 0 1 14 17.5H5V18A1.5 1.5 0 0 0 6.5 19.5H18.5A0.5 0.5 0 0 0 19 19V5A1 1 0 0 1 21 5V19A2.5 2.5 0 0 1 18.5 21.5H6.5A3.5 3.5 0 0 1 3 18V5A3 3 0 0 1 6 2ZM7.28 8.72L8.9 10.33L12.72 6.52A1.25 1.25 0 0 1 14.48 8.28L8.9 13.87L5.52 10.48A1.25 1.25 0 0 1 7.28 8.72Z"
        />
      </svg>
    </span>
  );
}
