import { JSX, Match, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { A } from "@revolt/routing";
import { Button } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Card that holds every logged-out flow, so login, sign-up, reset and
 * verify share one width, padding, type scale and action layout. On
 * phones the page itself is the surface, so the card drops its frame.
 */
export const FlowBase = styled("div", {
  base: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    width: "100%",
    padding: "24px",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-sidebar)",
    border: "1px solid var(--z-border-soft)",
    borderRadius: "14px",

    "@media (max-width: 480px)": {
      padding: 0,
      background: "transparent",
      border: "none",
      boxShadow: "none",
    },
  },
});

const Heading = styled("div", {
  base: {
    "& h1": {
      margin: 0,
      color: "var(--z-header-primary, var(--z-fg-primary))",
      fontSize: "22px",
      fontWeight: 700,
      lineHeight: "30px",
    },

    "& p": {
      margin: "4px 0 0",
      color: "var(--z-fg-secondary)",
      fontSize: "15px",
      lineHeight: "24px",
    },
  },
});

/**
 * Row at the end of a flow: an optional way back on the inline start, then
 * the primary action, which takes the remaining width
 */
const Actions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    marginTop: "8px",

    "& > :not([data-back])": { flex: "1 1 auto", minWidth: 0 },
  },
});

const backStyle = {
  display: "inline-flex",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minHeight: "44px",
  paddingInline: "12px",
  border: "none",
  borderRadius: "10px",
  background: "transparent",
  color: "var(--z-fg-secondary)",
  font: "inherit",
  fontSize: "15px",
  fontWeight: 500,
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
  "--z-icon-color": "currentColor",
  transition:
    "background-color var(--z-motion-fast, 120ms) ease, color var(--z-motion-fast, 120ms) ease",
  _motionReduce: { transition: "none" },
  _hover: { color: "var(--z-fg-primary)", background: "var(--z-nav-hover)" },
  _focusVisible: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
  // the arrow points the way back in right-to-left languages too
  "& > .z-icon": { _rtl: { transform: "scaleX(-1)" } },
} as const;

const BackLink = styled(A, { base: backStyle });
const BackButton = styled("button", { base: backStyle });

/**
 * The actions of a flow: "Back" (a link or a handler) and the primary action
 */
export function FlowActions(props: {
  /** Where "Back" goes, or what it does */
  back?: string | (() => void);
  /** Label for the way back (default "Back") */
  backLabel?: JSX.Element;
  children?: JSX.Element;
}) {
  const label = () => (
    <>
      <Icon name="arrow-left" size={18} />
      {props.backLabel ?? <Trans>Back</Trans>}
    </>
  );

  return (
    <Actions>
      <Show when={props.back}>
        {(back) => {
          const target = back();
          return typeof target === "string" ? (
            <BackLink href={target} data-back>
              {label()}
            </BackLink>
          ) : (
            <BackButton type="button" onClick={target} data-back>
              {label()}
            </BackButton>
          );
        }}
      </Show>
      {props.children}
    </Actions>
  );
}

/**
 * Quiet links under a flow's actions (forgot password, resend link)
 */
export const FlowLinks = styled("nav", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "4px 16px",
    width: "100%",

    "& a": {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "32px",
      paddingInline: "4px",
      borderRadius: "var(--z-radius-xs, 4px)",
      color: "var(--z-link)",
      fontSize: "14px",
      fontWeight: 500,
      textDecoration: "none",
      _phone: { minHeight: "44px" },
      _hover: { textDecoration: "underline" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
    },
  },
});

/** Flow text that isn't a heading (notices, explanations) */
export const FlowText = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-fg-secondary)",
    fontSize: "15px",
    lineHeight: "22px",
  },
});

const ButtonSlot = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    "& > button": { width: "100%" },
  },
});

const Spinner = styled("span", {
  base: {
    width: "16px",
    height: "16px",
    flexShrink: 0,
    borderRadius: "50%",
    border: "2px solid currentColor",
    borderInlineEndColor: "transparent",
    animation: "spin 700ms linear infinite",
    // no spinning with reduced motion: a still ring still says "waiting"
    _motionReduce: { animation: "none", opacity: 0.7 },
  },
});

const VisuallyHidden = styled("span", {
  base: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
});

/**
 * Primary button of a flow, 44 px high. While waiting on the server it
 * shows a spinner and says so to screen readers; a press while busy does
 * nothing (forms also refuse a second submit). It isn't greyed out, as
 * nothing is wrong.
 */
export function AuthButton(props: {
  type?: "submit" | "button";
  status?: "ready" | "submitting" | "success";
  onPress?: () => void;
  children: JSX.Element;
}) {
  const { t } = useLingui();
  const busy = () =>
    props.status === "submitting" || props.status === "success";

  return (
    <ButtonSlot>
      <Button
        type={props.type ?? "button"}
        size="xl"
        onPress={() => !busy() && props.onPress?.()}
      >
        <Switch>
          <Match when={props.status === "submitting"}>
            <Spinner aria-hidden="true" />
          </Match>
          <Match when={props.status === "success"}>
            <Icon name="check-circle" size={18} aria-hidden="true" />
          </Match>
        </Switch>
        {props.children}
      </Button>
      <VisuallyHidden role="status">
        {props.status === "submitting" ? t`Please wait…` : ""}
      </VisuallyHidden>
    </ButtonSlot>
  );
}

/**
 * Development-only shortcuts (mock submissions) appear with ?mock in the
 * address, so they never cover the real screens while testing
 */
export function showDevMocks() {
  return (
    import.meta.env.DEV && new URLSearchParams(location.search).has("mock")
  );
}

/**
 * Common heading for all logged-out flows.
 */
export function FlowTitle(props: {
  children: JSX.Element;
  subtitle?: JSX.Element;
}) {
  return (
    <Heading>
      <h1>{props.children}</h1>
      <Show when={props.subtitle}>
        <p>{props.subtitle}</p>
      </Show>
    </Heading>
  );
}
