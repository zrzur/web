import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { FlockDots } from "@revolt/ui/components/design/FlockDots";

/**
 * Divider line
 */
const Base = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: "16px 16px 8px",
    userSelect: "none",
    color: "var(--z-fg-muted)",
    "--line": "var(--z-border-soft)",

    // the line runs either side of the date; without one it is a single rule
    "&::before, &::after": {
      content: "''",
      flexGrow: 1,
      height: "1px",
      background: "var(--line)",
    },
    // "New" alone: one line up to the word
    "&:not(:has(time))::after": { display: "none" },

    "& time": {
      fontSize: "12px",
      lineHeight: "16px",
      fontWeight: 600,
    },
  },
  variants: {
    unread: {
      // the one place the list uses the action colour: where you left off
      true: { "--line": "var(--z-accent)" },
      false: {},
    },
  },
  defaultVariants: {
    unread: false,
  },
});

/**
 * "New", at the end of the line, in the text shade of the action colour
 */
const Unread = styled("div", {
  base: {
    order: 2,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-accent-text)",
  },
});

interface Props {
  /**
   * Display the date
   */
  date?: string;

  /**
   * Show unread indicator
   */
  unread?: boolean;
}

/**
 * Generic message divider
 */
export function MessageDivider(props: Props) {
  return (
    <Base unread={props.unread}>
      <Show when={props.unread}>
        <Unread>
          <FlockDots />
          <Trans>New</Trans>
        </Unread>
      </Show>
      <Show when={props.date}>
        <time>{props.date}</time>
      </Show>
    </Base>
  );
}
