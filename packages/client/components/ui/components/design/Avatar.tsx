import {
  JSXElement,
  Show,
  createContext,
  createMemo,
  createUniqueId,
  useContext,
} from "solid-js";

import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { withDefaultAvatar } from "../features/profiles/sampleAvatars";
import { Initials } from "../utils";

import { Ripple } from "./Ripple";

export type Props = {
  /**
   * Avatar size
   */
  size?: number;

  /**
   * Avatar shape
   */
  shape?: "circle" | "square" | "rounded-square" | "squircle";

  /**
   * Image source
   */
  src?: string;

  /**
   * Fallback if no source
   */
  fallback?: string | JSXElement;

  /**
   * If this avatar falls back, use primary contrasting colours
   */
  primaryContrast?: boolean;

  /**
   * Whether the fallback content is drawn on a background circle (default true)
   */
  fallbackBackground?: boolean;

  /**
   * Punch a hole through the avatar
   */
  holepunch?:
    | "bottom-right"
    | "top-right"
    | "right"
    | "overlap"
    | "overlap-subtle"
    | "none"
    | false;

  /**
   * Specify overlay component
   */
  overlay?: JSXElement;

  /**
   * Whether this icon is interactive
   */
  interactive?: boolean;

  /**
   * Click handler
   */
  onClick?: (e: MouseEvent) => void;

  /**
   * HTML Web Component slot
   */
  slot?: string;
};

/**
 * Avatar image
 */
const Image = styled("img", {
  base: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
});

/**
 * Text fallback container
 */
const FallbackBase = styled("div", {
  base: {
    width: "100%",
    height: "100%",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    fontWeight: 600,
    fontSize: "0.75rem",
  },
  variants: {
    contrast: {
      true: {
        color: "var(--md-sys-color-on-primary)",
        background: "var(--md-sys-color-primary)",
      },
      false: {
        fill: "var(--md-sys-color-on-surface)",
        color: "var(--md-sys-color-on-surface)",
        background: "var(--md-sys-color-surface-container-low)",
      },
      bare: {
        fill: "var(--md-sys-color-on-surface)",
        color: "var(--md-sys-color-on-surface)",
      },
    },
  },
  defaultVariants: {
    contrast: false,
  },
});

/**
 * Generic Avatar component
 *
 * Partially inspired by Adw.Avatar API, we allow users to specify a fallback component (usually just text) to display in case the URL is invalid.
 */
export function Avatar(props: Props) {
  // The status dot is drawn at r=5 in the 32-unit box (31% of the avatar),
  // which is far too big on large avatars. Scale it down so it stays
  // around a quarter of small avatars and ~20% of large ones, and keep the
  // cut-out gap at a steady 2-4px.
  const maskId = createUniqueId();
  const statusDot = createMemo(() => {
    const size = props.size ?? 32;
    const diameter = size <= 32 ? size * 0.27 : 8.6 + (size - 32) * 0.16;
    const scale = Math.min(1, diameter / ((size * 10) / 32));
    const gap = (Math.min(4, Math.max(2, size * 0.05)) * 32) / size;
    const r = 5 * scale;
    return { scale, r, cx: 32 - r, gap };
  });
  const scaledDot = () => props.holepunch === "bottom-right";
  const decorated = useContext(AvatarDecoratedContext);

  const avatar = (
    <ParentBase
      slot={props.slot}
      style={{
        width: props.size + "px",
        height: props.size + "px",
      }}
      viewBox="0 0 32 32"
      interactive={props.interactive}
      onClick={props.onClick}
    >
      <Show when={scaledDot()}>
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="32" height="32" fill="white" />
            <circle
              cx={statusDot().cx}
              cy={statusDot().cx}
              r={statusDot().r + statusDot().gap}
              fill="black"
            />
          </mask>
        </defs>
      </Show>
      <g
        mask={
          scaledDot()
            ? `url(#${maskId})`
            : props.holepunch && props.holepunch !== "none"
              ? `url(#holepunch-${props.holepunch})`
              : undefined
        }
      >
        <foreignObject
          x="0"
          y="0"
          width="32"
          height="32"
          class={css({ transition: "var(--transitions-fast) filter" })}
        >
          <Shape shape={props.shape}>
            <Show when={props.interactive}>
              <Ripple />
            </Show>
            <Show
              when={withDefaultAvatar(props.src)}
              keyed
              fallback={
                <FallbackBase
                  contrast={
                    props.fallbackBackground === false
                      ? "bare"
                      : props.primaryContrast
                  }
                >
                  {typeof props.fallback === "string" ? (
                    <Initials input={props.fallback} maxLength={2} />
                  ) : (
                    props.fallback
                  )}
                </FallbackBase>
              }
            >
              {/* the name always sits next to it: decorative for screen readers */}
              <Image
                src={withDefaultAvatar(props.src)}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            </Show>
          </Shape>
        </foreignObject>
      </g>
      <Show
        when={scaledDot() && !decorated}
        fallback={!scaledDot() && props.overlay}
      >
        {/* scale the overlay toward the bottom-right corner */}
        <g
          transform={`translate(32 32) scale(${statusDot().scale}) translate(-32 -32)`}
        >
          {props.overlay}
        </g>
      </Show>
    </ParentBase>
  );

  // inside a decoration the status dot goes on its own layer above the
  // artwork, on a small backing disc so it reads on top of it
  return (
    <Show when={decorated && scaledDot() && props.overlay} fallback={avatar}>
      {avatar}
      <svg
        class={overlayLayer}
        viewBox="0 0 32 32"
        style={{ width: props.size + "px", height: props.size + "px" }}
        aria-hidden="true"
      >
        <circle
          cx={statusDot().cx}
          cy={statusDot().cx}
          r={statusDot().r + statusDot().gap}
          fill="var(--avatar-status-ring, var(--z-bg-sidebar, #171925))"
        />
        <g
          transform={`translate(32 32) scale(${statusDot().scale}) translate(-32 -32)`}
        >
          {props.overlay}
        </g>
      </svg>
    </Show>
  );
}

/**
 * Lets an avatar know it sits inside an AvatarDecoration
 */
export const AvatarDecoratedContext = createContext(false);

/** Status layer drawn above a decoration's artwork */
const overlayLayer = css({
  position: "absolute",
  top: 0,
  left: 0,
  zIndex: 3,
  pointerEvents: "none",
  overflow: "visible",
});

/**
 * Avatar parent container
 */
const ParentBase = styled("svg", {
  base: {
    flexShrink: 0,
    userSelect: "none",
    cursor: "inherit",
  },
  variants: {
    interactive: {
      true: {
        cursor: "pointer",
      },
      false: {},
    },
  },
  defaultVariants: {
    interactive: false,
  },
});

/**
 * Shape container (for Ripple support)
 */
const Shape = styled("div", {
  base: {
    overflow: "hidden",
    width: "100%",
    height: "100%",
  },
  variants: {
    shape: {
      circle: {
        borderRadius: "var(--borderRadius-circle)",
      },
      square: {},
      "rounded-square": {
        borderRadius: "var(--borderRadius-md)",
      },
      squircle: {
        borderRadius: "34%",
      },
    },
  },
  defaultVariants: {
    shape: "circle",
  },
});
