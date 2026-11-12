import { Trans } from "@lingui/solid/macro";

import { styled } from "styled-system/jsx";

/** The documents a new account accepts; zrzur.com picks the language */
export const SIGN_UP_TERMS_URL = "https://zrzur.com/legal/terms";
export const SIGN_UP_GUIDELINES_URL =
  "https://zrzur.com/legal/community-guidelines";
export const SIGN_UP_PRIVACY_URL = "https://zrzur.com/legal/privacy";

/**
 * The line above "Create account": creating the account accepts the terms
 * and the guidelines, and the privacy policy has been there to read. The
 * server keeps which terms version was accepted and when (T-6).
 */
export function SignUpConsent() {
  return (
    <Consent data-testid="sign-up-consent">
      <Trans>
        By creating an account you accept the{" "}
        <a href={SIGN_UP_TERMS_URL} target="_blank" rel="noopener noreferrer">
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
        <a href={SIGN_UP_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        .
      </Trans>
    </Consent>
  );
}

const Consent = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    lineHeight: "20px",

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
