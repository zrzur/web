import { type JSX, createEffect, ErrorBoundary, on } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { isPartLoadError } from "../../../common/lib/lazyPart";
import { Button } from "../design/Button";
import { EmptyState } from "../design/EmptyState";

/**
 * Around a page, or a window's body: a part whose code could not be
 * downloaded (no connection for a moment) left an empty area with no way
 * on, the same dead end as the dead buttons of bug #3 (2026-11-22). Now the
 * app's empty state says what happened, and Try again asks for the part
 * once more (lazyPart forgot the failed download). In a window, the window
 * stays open and what was typed in it stays. Opening another page clears
 * the note. Any other error is a bug in the part: it goes up as before.
 *
 * @param resetKey Changes when another page opens (the address, the page)
 */
export function PageBoundary(props: {
  resetKey?: () => unknown;
  children: JSX.Element;
}) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => {
        if (!isPartLoadError(error)) throw error;
        console.warn("[app] a part could not be loaded", error);
        if (props.resetKey)
          createEffect(on(props.resetKey, () => reset(), { defer: true }));
        return (
          <Note role="alert" data-part-not-loaded>
            <EmptyState
              art="offline"
              title={<Trans>Could not open.</Trans>}
              description={<Trans>Check your connection and try again.</Trans>}
              action={
                <Button variant="tonal" onPress={reset}>
                  <Trans>Try again</Trans>
                </Button>
              }
            />
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
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * The note is shown when there is no connection: fetch its picture while
 * there is one, so the service worker keeps it (runtime image cache)
 */
if (typeof window !== "undefined" && typeof Image !== "undefined") {
  const warm = () => {
    new Image().src = `${import.meta.env.BASE_URL}brand/moods/alert.svg`;
  };
  if ("requestIdleCallback" in window)
    window.requestIdleCallback(warm, { timeout: 10000 });
  else setTimeout(warm, 3000);
}
