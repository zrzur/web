import { For, JSX, Match, Show, Switch, createMemo } from "solid-js";

import { css, cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { BadgeGlyph } from "./BadgeGlyph";
import { AnyBadgeId, BADGE_SIZES, BadgeSize, badgeMeta } from "./catalog";
import { useBadgeText } from "./useBadgeText";

/**
 * - `art`: only the picture, where its name is already written beside it
 * - `hover`: a tooltip on hover, inside a row that is itself pressable
 * - `press`: its own control; hover, keyboard focus and a tap all show the
 *   name and the description (44 px target on phones)
 */
export type BadgeMode = "art" | "hover" | "press";

/** `locked`: not earned yet. `quiet`: hidden from the profile, or in the past */
export type BadgeState = "locked" | "quiet";

/**
 * The one way to show a badge, anywhere in the app. Unknown ids draw
 * nothing, so a badge from a newer server never breaks a row.
 */
export function BadgeMark(props: {
  id: AnyBadgeId;
  size?: BadgeSize;
  mode?: BadgeMode;
  state?: BadgeState;
}) {
  const text = useBadgeText();
  const meta = () => badgeMeta(props.id);
  const size = () => props.size ?? "sm";
  const words = createMemo(() => text(props.id));
  const spoken = () =>
    words().description
      ? `${words().name}: ${words().description}`
      : words().name;

  const art = () => <BadgeGlyph badge={meta()!} size={BADGE_SIZES[size()]} />;
  const tip = () => (
    <BadgeTip>
      <strong dir="auto">{words().name}</strong>
      <Show when={words().description}>
        <span dir="auto">{words().description}</span>
      </Show>
    </BadgeTip>
  );

  return (
    <Show when={meta()}>
      <Switch
        fallback={
          <span
            class={mark({ size: size() })}
            data-state={props.state}
            aria-hidden="true"
          >
            {art()}
          </span>
        }
      >
        <Match when={props.mode === "press"}>
          <button
            type="button"
            class={mark({ size: size(), pressable: true })}
            data-badge-id={props.id}
            data-state={props.state}
            aria-label={spoken()}
            use:floating={{
              tooltip: {
                placement: "top",
                press: true,
                aria: spoken(),
                content: tip,
              },
            }}
          >
            {art()}
          </button>
        </Match>
        <Match when={props.mode === "hover"}>
          <span
            class={mark({ size: size() })}
            data-badge-id={props.id}
            data-state={props.state}
            role="img"
            aria-label={spoken()}
            use:floating={{
              tooltip: { placement: "top", aria: spoken(), content: tip },
            }}
          >
            {art()}
          </span>
        </Match>
      </Switch>
    </Show>
  );
}

/** The name and description of a badge, as its tooltip shows them */
export function BadgeTextTip(props: { id: AnyBadgeId }) {
  const text = useBadgeText();
  const words = createMemo(() => text(props.id));
  return (
    <BadgeTip>
      <strong dir="auto">{words().name}</strong>
      <Show when={words().description}>
        <span dir="auto">{words().description}</span>
      </Show>
    </BadgeTip>
  );
}

/**
 * A row of badges. It follows the reading direction and wraps; with
 * `mode="press"` on a phone each badge is a 44 px target, and the row
 * reaches past its edges so the art stays aligned with the text around it.
 */
export function BadgeList(props: {
  ids: AnyBadgeId[];
  /** what the list is, for screen readers */
  label: string;
  size?: BadgeSize;
  mode?: BadgeMode;
}) {
  return (
    <Show when={props.ids.length}>
      <span
        class={list({ pressable: props.mode === "press" })}
        role="list"
        aria-label={props.label}
      >
        <For each={props.ids}>
          {(id) => (
            <span role="listitem" class={item}>
              <BadgeMark id={id} size={props.size} mode={props.mode} />
            </span>
          )}
        </For>
      </span>
    </Show>
  );
}

/**
 * The word form of a badge (Bot, Official). Neutral by default; `filled`
 * (bots) is the Zrzur colour, the owner's call of 2026-11-12.
 */
export function BadgeTag(props: {
  children: JSX.Element;
  icon?: JSX.Element;
  /** a filled pill in the Zrzur colour (bots; owner 2026-11-12) */
  filled?: boolean;
}) {
  return (
    <span
      class={tag}
      data-badge-tag
      data-filled={props.filled ? "" : undefined}
    >
      {props.icon}
      {props.children}
    </span>
  );
}

const mark = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
    border: "none",
    borderRadius: "full",
    background: "transparent",
    "& > svg": { display: "block", flexShrink: 0 },

    // not earned yet: the art keeps its shape, loses most of its colour
    "&[data-state='locked']": {
      filter: "grayscale(0.85) brightness(0.9)",
      opacity: 0.6,
      transition: "filter 120ms ease, opacity 120ms ease",
      _motionReduce: { transition: "none" },
    },
    "&[data-state='quiet']": { filter: "grayscale(0.7)", opacity: 0.6 },
  },
  variants: {
    size: {
      xs: { width: "16px", height: "16px" },
      sm: { width: "20px", height: "20px" },
      card: { width: "24px", height: "24px" },
      md: { width: "32px", height: "32px" },
      lg: { width: "40px", height: "40px" },
      xl: { width: "48px", height: "48px" },
    },
    pressable: {
      true: {
        cursor: "pointer",
        // 24 px anywhere (WCAG 2.5.8), 44 px on phones
        minWidth: "24px",
        minHeight: "24px",
        _phone: { minWidth: "44px", minHeight: "44px" },
        transition: "filter 120ms ease",
        _motionReduce: { transition: "none" },
        _hover: { filter: "brightness(1.15)" },
        _active: { filter: "brightness(0.9)" },
        _focusVisible: {
          outline: "2px solid var(--z-focus)",
          outlineOffset: "2px",
        },
      },
    },
  },
});

const list = cva({
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px",
    width: "fit-content",
    maxWidth: "100%",
    minWidth: 0,
  },
  variants: {
    pressable: {
      true: {
        // above plain text beside it, which these targets reach over
        _phone: { gap: 0, margin: "-12px", position: "relative", zIndex: 1 },
      },
    },
  },
});

const item = css({ display: "inline-flex", flexShrink: 0 });

const tag = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  flexShrink: 0,
  height: "20px",
  paddingInline: "4px",
  borderRadius: "var(--z-radius-sm)",
  background: "var(--z-btn-surface-bg)",
  border: "1px solid var(--z-btn-surface-border)",
  // primary text: themeLibrary.test.ts holds this pair to AA in every theme
  color: "var(--z-fg-primary)",
  "--z-icon-color": "var(--z-fg-primary)",
  fontSize: "12px",
  fontWeight: 600,
  lineHeight: 1,

  // bots: a filled pill like a name tag, the Zrzur colour with its on-colour
  // text (contrast held by the theme), capitals in Latin scripts
  "&[data-filled]": {
    height: "16px",
    paddingInline: "5px",
    gap: "3px",
    borderRadius: "4px",
    border: "none",
    background: "var(--z-btn-primary-bg)",
    color: "var(--z-on-accent)",
    "--z-icon-color": "var(--z-on-accent)",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
});

const BadgeTip = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxWidth: "240px",
    textAlign: "start",
    "& strong": { fontSize: "13px", fontWeight: 600 },
    "& span": {
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-secondary)",
    },
  },
});
