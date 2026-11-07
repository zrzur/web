import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useLocation } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LoadingScreen } from "@revolt/ui";

import { goingHome } from "./goingHome";
import { useGreeting } from "./greeting";

/**
 * What shows until the app has connected. Someone coming back to Home is
 * greeted straight away, from what this device remembers, with the page's
 * frame around it; the rest of Home needs the server's answer, which on a slow
 * phone is the slowest part of opening the app. Everyone else gets the
 * loading screen.
 */
export function FirstScreen() {
  const state = useState();
  const location = useLocation();

  const name = () => state.auth.getName();
  const greeting = useGreeting(() => name() ?? "");

  return (
    <Show
      when={name() && goingHome(location.pathname)}
      fallback={<LoadingScreen />}
    >
      <Frame>
        <Rail />
        <Side />
        <Page>
          <Content>
            <Hero>
              <Round />
              <div>
                <h1>{greeting()}</h1>
                <p>
                  <Trans>Welcome back to Zrzur.</Trans>
                </p>
              </div>
            </Hero>
          </Content>
          <LoadingScreen />
        </Page>
      </Frame>
    </Show>
  );
}

const Frame = styled("div", {
  base: {
    display: "flex",
    flexGrow: 1,
    minHeight: 0,
    height: "100%",
    background: "var(--z-bg-frame, var(--md-sys-color-surface))",
    // phones: measured from the top of the app, not from under the bar that
    // comes after 1.5 s of connecting, so that bar moves nothing here. It sits
    // behind the bar for the same reason
    _phone: { position: "fixed", inset: 0, zIndex: -1 },
  },
});

/** Same place as the server rail, which comes with the answer */
const Rail = styled("div", {
  base: {
    flexShrink: 0,
    width: "var(--z-rail-width, 72px)",
    _phone: { display: "none" },
  },
});

/** Same place as the channel list */
const Side = styled("div", {
  base: {
    flexShrink: 0,
    width: "var(--z-sidebar-width, var(--layout-width-channel-sidebar))",
    background: "var(--z-bg-shell, var(--z-bg-chat))",
    borderInlineEnd: "1px solid var(--z-border-subtle)",
    _phone: { display: "none" },
  },
});

const Page = styled("main", {
  base: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-shell, var(--z-bg-chat))",
    borderTop: "1px solid var(--z-border-subtle)",
  },
});

// the measures below are Home's, so the words do not move when it arrives
const Content = styled("div", {
  base: {
    width: "100%",
    maxWidth: "808px",
    marginInline: "auto",
    boxSizing: "border-box",
    padding: "80px 24px 0",
    _phone: { padding: "72px 16px 0" },
  },
});

const Hero = styled("section", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    minWidth: 0,
    padding: "24px",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    border: "1px solid var(--z-card-border)",
    background: "var(--z-card-bg, transparent)",
    boxShadow: "var(--z-card-lift)",
    _phone: { padding: "16px" },

    "& h1": {
      margin: 0,
      fontSize: "24px",
      lineHeight: "30px",
      fontWeight: 700,
      overflowWrap: "anywhere",
    },
    "& p": {
      margin: "4px 0 0",
      fontSize: "14px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Round = styled("div", {
  base: {
    flexShrink: 0,
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "var(--z-nav-hover)",
  },
});
