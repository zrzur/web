import { type JSX, createEffect, ErrorBoundary, on } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { isPartLoadError } from "@revolt/common/lib/lazyPart";
import { Button } from "@revolt/ui";

/**
 * Around the page area: a page whose code could not be downloaded (no
 * connection for a moment) showed an empty area with no way on, the same
 * dead end as the dead buttons of bug #3 (2026-11-22). Now a short note
 * says what happened, and Try again asks for the page once more (lazyPart
 * forgets the failed download). Opening another page clears the note.
 * Any other error is a bug in the page: it goes up as before.
 *
 * @param resetKey Changes when another page opens (the address)
 */
export function PageBoundary(props: {
  resetKey?: () => unknown;
  children: JSX.Element;
}) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => {
        if (!isPartLoadError(error)) throw error;
        console.warn("[app] a page could not be loaded", error);
        if (props.resetKey)
          createEffect(on(props.resetKey, () => reset(), { defer: true }));
        return (
          <Note role="alert">
            <p>
              <Trans>
                Could not open. Check your connection and try again.
              </Trans>
            </p>
            <Button variant="tonal" onPress={reset}>
              <Trans>Try again</Trans>
            </Button>
          </Note>
        );
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

const Note = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "24px 16px",
    textAlign: "center",
    color: "var(--z-fg-secondary)",
    fontSize: "15px",
    lineHeight: "22px",
    "& > p": { margin: 0, maxWidth: "320px" },
  },
});
