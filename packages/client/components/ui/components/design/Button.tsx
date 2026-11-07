import { createRenderEffect, mergeProps, on, splitProps } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

import { AriaButtonProps, createButton } from "@solid-aria/button";
import { cva } from "styled-system/css/cva";

import { typography } from "./Text";

type Props = Omit<
  Parameters<typeof button>[0] &
    AriaButtonProps &
    JSX.DirectiveAttributes &
    Pick<
      JSX.ButtonHTMLAttributes<HTMLButtonElement>,
      "role" | "tabIndex" | "aria-selected"
    >,
  "onClick" | "_permitAnimation" | "disabled"
> & {
  groupActive?: boolean;
  bg?: string;
};

/**
 * Buttons prompt most actions in a UI
 *
 * If you wish to create standard button groups:
 *
 * ```tsx
 * <Row>
 *   <Button
 *     onPress={() => setActiveA()}
 *     groupActive={activeA()}
 *     group="standard"
 *   >
 *     Button A
 *   </Button>
 *   <Button
 *     onPress={() => setActiveB()}
 *     groupActive={activeB()}
 *     group="standard"
 *   >
 *     Button B
 *   </Button>
 *   <Button
 *     onPress={() => setActiveC()}
 *     groupActive={activeC()}
 *     group="standard"
 *   >
 *     Button C
 *   </Button>
 * </Row>
 * ```
 *
 * If you wish to create connected button groups:
 *
 * ```tsx
 * <Row>
 *   <Button
 *     onPress={() => setActiveA()}
 *     groupActive={activeA()}
 *     group="connected-start"
 *   >
 *     Button A
 *   </Button>
 *   <Button
 *     onPress={() => setActiveB()}
 *     groupActive={activeB()}
 *     group="connected"
 *   >
 *     Button B
 *   </Button>
 *   <Button
 *     onPress={() => setActiveC()}
 *     groupActive={activeC()}
 *     group="connected-end"
 *   >
 *     Button C
 *   </Button>
 * </Row>
 * ```
 *
 * Zrzur button — desktop-first proportions (Material M3 sizing abandoned).
 */
export function Button(props: Props) {
  const [passthrough, propsRest] = splitProps(props, [
    "aria-selected",
    "tabIndex",
    "role",
  ]);

  const [style, rest] = splitProps(propsRest, [
    "bg",
    "size",
    "shape",
    "variant",
    "group",
    "groupActive",
  ]);
  let ref: HTMLButtonElement | undefined;

  const shape = () =>
    style.group
      ? style.groupActive !== (style.group === "standard")
        ? "round"
        : "square"
      : (style.shape ?? "square");

  const variant = () =>
    style.group ? (style.groupActive ? "filled" : "tonal") : style.variant;

  let _permitAnimation = false;
  createRenderEffect(
    on(
      () => shape(),
      () => (_permitAnimation = true),
      { defer: true },
    ),
  );

  const [btn, noBtnRest] = splitProps(rest, ["onPress"]);

  //Emulate delay of native onClick
  // See issue https://github.com/solidjs-community/solid-aria/issues/84
  // Delay must be at least 32ms for Safari
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPress = (e: any) => setTimeout(() => btn.onPress?.(e), 32),
    btnRest = mergeProps(noBtnRest, { onPress, preventFocusOnPress: true });

  const { buttonProps } = createButton(btnRest, () => ref);
  return (
    <button
      {...passthrough}
      {...buttonProps}
      ref={ref}
      class={button({
        shape: shape(),
        variant: variant(),
        size: style.size,
        group: style.group,
        disabled: buttonProps.disabled,
        _permitAnimation,
      })}
      style={{
        "background-color": style.bg,
      }}
      // @codegen directives props=rest include=floating
    >
      {rest.children}
    </button>
  );
}

/*
 * Flat fills (design direction 2026-11-03): the fill steps darker on hover and
 * again when pressed, the border does the rest. Dialogs set --z-btn-tonal-* to
 * their own navy steps.
 */
const filledButton = {
  background: "var(--z-accent-fill, var(--z-accent))",
  "--color": "var(--z-on-accent)",
  "&:hover:not(:disabled)": { background: "var(--z-accent-hover)" },
  "&:active:not(:disabled)": { background: "var(--z-accent-pressed)" },
};

const tonalButton = {
  background: "var(--z-btn-tonal-bg, var(--z-btn-surface-bg))",
  "--color": "var(--z-fg-primary)",
  borderColor: "var(--z-btn-tonal-border, var(--z-btn-surface-border))",
  "&:hover:not(:disabled)": {
    background: "var(--z-btn-tonal-hover, var(--z-btn-surface-hover))",
  },
  "&:active:not(:disabled)": { background: "var(--z-border-strong)" },
};

const outlinedButton = {
  background: "transparent",
  borderColor: "var(--z-btn-outline-border)",
  "--color": "var(--z-fg-primary)",
  "&:hover:not(:disabled)": {
    background: "var(--z-nav-hover)",
    borderColor: "color-mix(in srgb, var(--z-fg-primary) 26%, transparent)",
  },
  "&:active:not(:disabled)": { background: "var(--z-nav-selected)" },
};
const textButton = {
  background: "transparent",
  "--color": "var(--z-fg-secondary)",
  "&:hover:not(:disabled)": {
    "--color": "var(--z-fg-primary)",
    background: "var(--z-nav-hover)",
  },
  "&:active:not(:disabled)": { background: "var(--z-nav-selected)" },
};

const errorButton = {
  background: "var(--z-danger-strong, var(--z-danger))",
  "--color": "var(--z-on-danger, #fff)",
  "&:hover:not(:disabled)": { background: "var(--z-danger-hover)" },
  "&:active:not(:disabled)": {
    background: "color-mix(in srgb, var(--z-danger-hover) 85%, black)",
  },
};

// positive outcomes: a tinted surface with the success colour as text
const successButton = {
  background: "color-mix(in srgb, var(--z-live) 16%, transparent)",
  borderColor: "color-mix(in srgb, var(--z-live) 38%, transparent)",
  "--color": "var(--z-live)",
  "&:hover:not(:disabled)": {
    background: "color-mix(in srgb, var(--z-live) 24%, transparent)",
  },
  "&:active:not(:disabled)": {
    background: "color-mix(in srgb, var(--z-live) 30%, transparent)",
  },
};

/**
 * Desktop button styling: one restrained radius, compact heights, token colours.
 * (Material pill/morph shapes and ripples were removed; variant names are kept
 * so existing call sites keep working.)
 */
const button = cva({
  base: {
    ...typography.raw(),
    // phones: a 44 px tap target (phone rules)
    _phone: { minHeight: "44px", minWidth: "44px" },

    position: "relative",
    paddingInline: "var(--padding-inline)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",

    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "inherit",
    lineHeight: "20px",
    whiteSpace: "nowrap",

    cursor: "pointer",
    border: "1px solid transparent",
    borderRadius: "var(--z-radius, 10px)",
    transition:
      "background-color var(--z-motion-fast, 120ms) var(--z-ease-standard, ease), border-color var(--z-motion-fast, 120ms) var(--z-ease-standard, ease), color var(--z-motion-fast, 120ms) var(--z-ease-standard, ease), transform 80ms var(--z-ease-standard, ease)",

    color: "var(--color)",
    fill: "var(--color)",
    "--z-icon-color": "currentColor",

    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },

    // every variant has rest, hover, pressed and disabled; motion follows
    // the system setting
    // a small press, answering the finger
    "&:active:not(:disabled)": { transform: "scale(0.98)" },
    _motionReduce: {
      transition: "none",
      "&:active:not(:disabled)": { transform: "none" },
    },
  },
  variants: {
    /*
     * Roles: filled = the one primary action of a group; tonal = secondary
     * (also when several actions weigh the same); outlined / text = quiet;
     * _error = destructive, can't be undone. Hover and pressed never apply
     * while disabled.
     */
    variant: {
      elevated: {
        background: "var(--z-bg-raised)",
        borderColor: "var(--z-btn-surface-border)",
        "--color": "var(--z-fg-primary)",
        "&:hover:not(:disabled)": { background: "var(--z-slate-1)" },
        "&:active:not(:disabled)": { background: "var(--z-slate-2)" },
      },
      // primary: the deeper pink with white text (4.7:1), darker on hover
      filled: filledButton,
      // the slate ladder: surface at rest, the next step on hover
      tonal: tonalButton,
      outlined: outlinedButton,
      text: textButton,
      _error: errorButton,

      // positive confirmation
      success: successButton,
      /**
       * @deprecated
       */
      warning: {
        fill: "var(--unset-fg)",
        color: "var(--unset-fg)",
        background: "var(--unset-bg)",
      },
      /**
       * @deprecated use _error (rendered the same)
       */
      error: errorButton,
      /**
       * @deprecated use filled (rendered the same)
       */
      primary: filledButton,
      /**
       * @deprecated use tonal (rendered the same)
       */
      secondary: tonalButton,
      /**
       * @deprecated use text (rendered the same)
       */
      plain: textButton,
    },
    /**
     * Kept for API compatibility; both render the same desktop radius
     */
    shape: {
      round: {},
      square: {},
    },
    /**
     * Button groups: connected groups share inner edges
     */
    group: {
      "connected-start": {
        borderStartEndRadius: "2px",
        borderEndEndRadius: "2px",
      },
      "connected-end": {
        borderStartStartRadius: "2px",
        borderEndStartRadius: "2px",
      },
      connected: { borderRadius: "2px" },
      standard: {},
    },
    /**
     * Internal helper (shape morph animation removed)
     */
    _permitAnimation: {
      true: {},
      false: {},
    },
    size: {
      xs: {
        height: "28px",
        fontSize: "13px",
        "--padding-inline": "10px",
      },
      sm: {
        height: "32px",
        "--padding-inline": "12px",
      },
      md: {
        height: "36px",
        "--padding-inline": "16px",
      },
      lg: {
        height: "40px",
        "--padding-inline": "18px",
      },
      xl: {
        height: "44px",
        "--padding-inline": "22px",
      },

      icon: {
        width: "32px",
        height: "32px",
        "--padding-inline": "0",
      },
      /**
       * @deprecated
       */
      small: {
        height: "32px",
        "--padding-inline": "12px",
      },
      /**
       * @deprecated
       */
      normal: {
        height: "36px",
        minWidth: "96px",
        "--padding-inline": "16px",
      },
      /**
       * @deprecated
       */
      fab: {
        width: "40px",
        height: "40px",
      },
      /**
       * @deprecated
       */
      fluid: {},
      /**
       * @deprecated
       */
      inline: {
        padding: "var(--gap-xs) var(--gap-md)",
        fontSize: "0.8125rem",
      },
      /**
       * @deprecated
       */
      none: {
        borderRadius: "0",
      },
    },
    /**
     * Whether the button is disabled
     */
    disabled: {
      true: {
        cursor: "not-allowed",
        opacity: 0.5,
      },
      false: {},
    },
  },
  defaultVariants: {
    size: "sm",
    shape: "square",
    variant: "filled",
    disabled: false,
  },
});
