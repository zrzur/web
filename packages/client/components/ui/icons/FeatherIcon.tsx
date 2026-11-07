import { Show, createUniqueId } from "solid-js";

/**
 * Feather: the mark of server feathers (members give a server feathers to
 * level it up). Drawn here because the icon set has no feather.
 *
 * - `color`: vane in the app accent, with a light edge
 * - `plain`: one colour (currentColor), for buttons and small labels
 * - `dim`: muted, for levels not reached yet
 */
export function FeatherIcon(props: {
  size?: number;
  tone?: "color" | "plain" | "dim";
}) {
  const id = createUniqueId();
  const size = () => props.size ?? 20;
  const tone = () => props.tone ?? "color";
  const fill = () =>
    tone() === "color"
      ? `url(#${id}-vane)`
      : tone() === "dim"
        ? "var(--z-fg-muted)"
        : "currentColor";

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ "flex-shrink": 0, overflow: "visible" }}
    >
      <Show when={tone() === "color"}>
        <defs>
          {/* the app accent, lit at the tip and deeper at the quill */}
          <linearGradient id={`${id}-vane`} x1="0.9" y1="0" x2="0.1" y2="1">
            <stop
              offset="0"
              style={{ "stop-color": "var(--z-premium-light)" }}
            />
            <stop offset="0.45" style={{ "stop-color": "var(--z-premium)" }} />
            <stop
              offset="1"
              style={{
                "stop-color":
                  "color-mix(in srgb, var(--z-premium) 70%, var(--z-premium-deep))",
              }}
            />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#fff" stop-opacity="0.85" />
            <stop offset="1" stop-color="#fff" stop-opacity="0" />
          </linearGradient>
        </defs>
      </Show>
      {/* vane */}
      <path
        d="M20.6 2.6c-5.9-.4-11.6 3.3-13.5 9.6l-1.5 5 2.3-.7c.4-1.3 1.1-2.6 2-3.6l-1 3.2c6.2-.3 10.9-4.9 11.9-11 .2-1.4-.1-2.3-.2-2.5Z"
        fill={fill()}
        opacity={tone() === "dim" ? 0.55 : 1}
      />
      {/* light along the top edge */}
      <Show when={tone() === "color"}>
        <path
          d="M19.4 3.7c-4.6.2-8.8 3.1-10.4 7.9"
          fill="none"
          stroke={`url(#${id}-edge)`}
          stroke-width="1.1"
          stroke-linecap="round"
        />
      </Show>
      {/* barbs: three notches cut into the vane, shorter toward the tip */}
      <path
        d="M17.3 6.6 19.6 5.6M14.6 9.6 18 8.3M12.2 12.9l3.6-.9"
        fill="none"
        stroke={
          tone() === "plain"
            ? "var(--z-feather-cut, rgb(0 0 0 / 35%))"
            : "rgb(0 0 0 / 35%)"
        }
        stroke-width="1"
        stroke-linecap="round"
      />
      {/* shaft */}
      <path
        d="M3.4 20.6 15.8 8.2"
        fill="none"
        stroke={tone() === "color" ? "#fff4fa" : fill()}
        stroke-width="1.5"
        stroke-linecap="round"
        opacity={tone() === "dim" ? 0.55 : 0.95}
      />
    </svg>
  );
}
