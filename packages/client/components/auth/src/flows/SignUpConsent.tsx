import { Trans } from "@lingui/solid/macro";
import { Show, createUniqueId } from "solid-js";

import { styled } from "styled-system/jsx";

import { useFieldError } from "./fieldErrors";

/** The documents a new account accepts; zrzur.com picks the language */
export const SIGN_UP_TERMS_URL = "https://zrzur.com/legal/terms";
export const SIGN_UP_GUIDELINES_URL =
  "https://zrzur.com/legal/community-guidelines";
export const SIGN_UP_PRIVACY_URL = "https://zrzur.com/legal/privacy";

/** Name of the box in the form's data */
export const SIGN_UP_CONSENT_FIELD = "accept-terms";

/**
 * The box above "Create account": the person ticks it to accept the terms
 * and the guidelines and to say the privacy policy has been read. The form
 * does not go out while it is empty, and says so under the box. The server
 * keeps which terms version was accepted and when (T-6).
 */
export function SignUpConsent() {
  const error = useFieldError(SIGN_UP_CONSENT_FIELD);
  const errorId = createUniqueId();

  return (
    <Wrap>
      <Consent
        data-testid="sign-up-consent"
        data-invalid={error.message() ? "true" : undefined}
      >
        <input
          type="checkbox"
          name={SIGN_UP_CONSENT_FIELD}
          required
          aria-invalid={error.message() ? true : undefined}
          aria-describedby={error.message() ? errorId : undefined}
          onChange={() => error.clear()}
        />
        <Box aria-hidden="true">
          {/* drawn here, so the line needs nothing but itself */}
          <svg viewBox="0 0 12 12" width="12" height="12">
            <path
              d="M2.5 6.2 5 8.6l4.5-5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </Box>
        <span>
          <Trans>
            I accept the{" "}
            <a
              href={SIGN_UP_TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </a>{" "}
            and the{" "}
            <a
              href={SIGN_UP_GUIDELINES_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Community Guidelines
            </a>{" "}
            and have read the{" "}
            <a
              href={SIGN_UP_PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            .
          </Trans>
        </span>
      </Consent>
      <Show when={error.message()}>
        <Problem id={errorId} role="alert">
          {error.message()}
        </Problem>
      </Show>
    </Wrap>
  );
}

const Wrap = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "6px" },
});

const Consent = styled("label", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    margin: 0,
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    lineHeight: "20px",
    cursor: "pointer",

    // the real box: there for the keyboard and for screen readers, drawn by
    // the square next to it
    "& > input": {
      position: "absolute",
      insetInlineStart: 0,
      top: 0,
      width: "20px",
      height: "20px",
      margin: 0,
      opacity: 0,
      cursor: "pointer",
    },
    // phones: the whole 44 px corner takes the tap
    "@media (max-width: 600px)": {
      "& > input": {
        width: "44px",
        height: "44px",
        top: "-12px",
        insetInlineStart: "-12px",
      },
    },
    "& > input:focus-visible + span": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > input:checked + span": {
      background: "var(--z-accent-fill, var(--z-accent))",
      borderColor: "transparent",
      color: "var(--z-on-accent, #fff)",
    },
    "&:hover > input:not(:checked) + span": {
      borderColor: "var(--z-fg-muted)",
    },
    "&[data-invalid='true'] > input:not(:checked) + span": {
      borderColor: "var(--z-danger)",
    },

    "& a": {
      color: "var(--z-link)",
      fontWeight: 500,
      textDecoration: "underline",
      borderRadius: "var(--z-radius-xs, 4px)",
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
    },
  },
});

const Box = styled("span", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "20px",
    height: "20px",
    borderRadius: "6px",
    border: "1px solid var(--z-border-strong)",
    background: "var(--z-field-bg, var(--z-bg-input))",
    // the check shows only once the box is ticked
    color: "transparent",
    transition: "background-color 120ms ease, border-color 120ms ease",
    _motionReduce: { transition: "none" },
  },
});

const Problem = styled("p", {
  base: {
    margin: 0,
    paddingInlineStart: "32px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-danger)",
  },
});
