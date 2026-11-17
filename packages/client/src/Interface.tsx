import {
  createEffect,
  createSignal,
  JSX,
  lazy,
  Match,
  on,
  onCleanup,
  Show,
  Suspense,
  Switch,
} from "solid-js";

import { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { ChannelContextMenu, ServerContextMenu } from "@revolt/app";
import { MessageCache } from "@revolt/app/interface/channels/text/MessageCache";
import { Titlebar } from "@revolt/app/interface/desktop/Titlebar";
import { ChangeRequestNotice } from "@revolt/app/interface/settings/user/account/ChangeRequestNotice";
import { NoticeCenter } from "@revolt/app/interface/support/NoticeCenter";
import { useClient, useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";
import { NotificationsWorker } from "@revolt/client/NotificationsWorker";
import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";
import { PluginHostGate } from "@revolt/plugins/PluginHostGate";
import { Navigate, useBeforeLeave, useLocation } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import { useMotion } from "@revolt/ui/motion";

import { SlideDrawer } from "../components/ui/components/navigation/SlideDrawer";
import { Sidebar } from "./interface/Sidebar";
import { FirstScreen } from "./interface/home/FirstScreen";
import { goingHome } from "./interface/home/goingHome";
import { NEXT_SCREENS, preloadWhenIdle } from "./interface/idlePreload";
import { PhoneTabs } from "./interface/navigation/PhoneTabs";

/** Longest wait for unread state before Home draws without it */
const UNREADS_WAIT = 800;

/**
 * Application layout
 */
const StreamerIndicator = lazy(
  () => import("@revolt/app/interface/StreamerIndicator"),
);

const InstallOffer = lazy(() =>
  import("@revolt/pwa/InstallOffer").then((m) => ({ default: m.InstallOffer })),
);

const Interface = (props: { children?: JSX.Element }) => {
  const state = useState();
  const client = useClient();
  const { openModal } = useModals();
  const { isLoggedIn, lifecycle } = useClientLifecycle();
  const device = useDevice();
  // reactive copy, for the panel corner when the channel list is hidden
  const location = useLocation();

  useBeforeLeave((e) => {
    if (!e.defaultPrevented) {
      if (e.to === "/settings") {
        e.preventDefault();
        openModal({ type: "settings", config: "user" });
      } else if (typeof e.to === "string") {
        state.layout.setLastActivePath(e.to);
      }
    }
  });

  createEffect(() => {
    if (!isLoggedIn()) {
      // the query too: a public site sends people here with ?join=1
      state.layout.setNextPath(location.pathname + location.search);
      console.debug("WAITING... currently", lifecycle.state());
    }
  });

  // the app is up: bring in what people open next, until it goes away
  createEffect(() => {
    if (lifecycle.loadedOnce()) onCleanup(preloadWhenIdle(NEXT_SCREENS));
  });

  // Home's first draw waits a moment for unread state: what is waiting joins
  // the page and the server rail, and arriving later pushed both down. Never
  // for long, the request can be slow or refused (see the SDK's Ready)
  const [settled, setSettled] = createSignal(false);
  createEffect(() => {
    if (settled() || !lifecycle.loadedOnce()) return;
    if (!goingHome(location.pathname) || client().channelUnreads.loaded) {
      setSettled(true);
      return;
    }
    const timer = setTimeout(() => setSettled(true), UNREADS_WAIT);
    onCleanup(() => clearTimeout(timer));
  });

  // Discover and You are tabs of the phone's bar, and each is a whole page
  // on the page side of the slide: the bar stays under them. So does it under
  // Home, the logo's page: every list is one press away from there too.
  const tabPage = () =>
    device.layout() === "phone" &&
    (location.pathname.startsWith("/discover") ||
      location.pathname.startsWith("/you") ||
      goingHome(location.pathname));

  function isDisconnected() {
    return [
      State.Connecting,
      State.Disconnected,
      State.Reconnecting,
      State.Offline,
    ].includes(lifecycle.state());
  }

  //Drawer slider for mobile
  let rootRef: HTMLDivElement | undefined, sDrawer: SlideDrawer | undefined;
  const [contRef, setContRef] = createSignal<HTMLDivElement>();
  function rstLayout() {
    state.layout.setSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, false, false);
    state.layout.setSectionState(LAYOUT_SECTIONS.MEMBER_SIDEBAR, false, true);
  }
  createEffect(() => {
    //Create drawer
    const cont = contRef();
    if (cont && !sDrawer) sDrawer = new SlideDrawer(cont, rootRef!);
    //Update on layout change
    if (sDrawer) {
      const en = sDrawer.enabled;
      setTimeout(() => {
        state.setAppDrawer(en ? sDrawer : undefined);
        if (en) rstLayout();
      }, 1);
    }
  });
  onCleanup(() => {
    sDrawer?.delete();
    state.setAppDrawer((sDrawer = undefined));
  });

  // Phones: Back (the system's, in an installed app the only one) from a
  // conversation returns to the list it was opened from, not to the Home
  // page that shares the list's address.
  // The router may move the address before or after this listener hears of
  // the Back, so each side notes its time and either one settles it.
  let popped = -Infinity;
  let moved: { from?: string; to: string; at: number } | undefined;
  const settleBack = () => {
    if (!moved || Math.abs(moved.at - popped) > 600) return;
    const { from, to } = moved;
    moved = undefined;
    popped = -Infinity;
    if (from?.startsWith("/channel/") && goingHome(to))
      sDrawer?.setShown(false);
  };
  const onPop = () => {
    popped = performance.now();
    settleBack();
  };
  window.addEventListener("popstate", onPop);
  onCleanup(() => window.removeEventListener("popstate", onPop));
  createEffect(
    on(
      () => location.pathname,
      (to, from) => {
        moved = { from, to, at: performance.now() };
        settleBack();
      },
    ),
  );

  // switching servers animates the channel list and the page, switching
  // channels only the page
  const motion = useMotion();
  const place = (path: string) => {
    const [, server, channel] =
      /^\/server\/([^/]+)(?:\/channel\/([^/]+))?/.exec(path) ??
      /^()\/channel\/([^/]+)/.exec(path) ??
      [];
    return { server: server || "home", channel: channel ?? path };
  };
  createEffect(
    on(
      () => place(location.pathname),
      (next, previous) => {
        if (!previous) return;
        const page = contRef()?.firstElementChild;
        if (next.server !== previous.server) {
          motion.play(
            rootRef?.querySelector(".channel_bar"),
            "servers",
            "enter",
          );
          motion.play(page, "servers", "enter");
        } else if (next.channel !== previous.channel) {
          motion.play(page, "channels", "enter");
        }
      },
    ),
  );

  return (
    <MessageCache client={client()}>
      <AppRoot ref={rootRef} class="app_root">
        <Titlebar />
        <Switch fallback={<FirstScreen />}>
          {/* the developer docs have their own route (index.tsx) */}
          <Match when={!isLoggedIn()}>
            <Navigate href="/login" />
          </Match>
          <Match when={lifecycle.loadedOnce() && settled()}>
            <Layout
              disconnected={isDisconnected()}
              style={{ "flex-grow": 1, "min-height": 0 }}
              onDragOver={(e) => {
                if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
              }}
              onDrop={(e) => e.preventDefault()}
            >
              <Sidebar
                menuGenerator={(target) => ({
                  contextMenu: () => {
                    return (
                      <>
                        {target instanceof Server ? (
                          <ServerContextMenu server={target} />
                        ) : (
                          <ChannelContextMenu channel={target} />
                        )}
                      </>
                    );
                  },
                })}
              />
              <Content
                ref={setContRef}
                class="app_body"
                data-tab-page={tabPage() ? "" : undefined}
                sidebar={
                  state.layout.getSectionState(
                    LAYOUT_SECTIONS.PRIMARY_SIDEBAR,
                    true,
                  ) &&
                  !location.pathname.startsWith("/discover") &&
                  !location.pathname.startsWith("/designs") &&
                  // the Developer Portal is a full page with its own way back
                  !location.pathname.startsWith("/developers")
                }
              >
                {props.children}
                {/* phones: a tab's own page keeps the tab bar under it */}
                <Show when={tabPage()}>
                  <PhoneTabs page />
                </Show>
              </Content>
            </Layout>
          </Match>
        </Switch>

        <NotificationsWorker />
        {/* the small "Streamer mode" sign at the top, loaded the first time
            the mode is on */}
        <Show when={state.settings.streamerMode}>
          <Suspense>
            <StreamerIndicator />
          </Suspense>
        </Show>
        {/* plugins load lazily, for a signed-in user, if the server has them on */}
        <Show when={isLoggedIn()}>
          <ChangeRequestNotice />
          <NoticeCenter />
        </Show>
        <Show when={isLoggedIn()}>
          <PluginHostGate />
        </Show>
        {/* "install the app", once, on a phone (loaded after the app is up) */}
        <Show when={lifecycle.loadedOnce() && settled()}>
          <Suspense>
            <InstallOffer />
          </Suspense>
        </Show>
      </AppRoot>
    </MessageCache>
  );
};

const AppRoot = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
});

/**
 * Parent container
 */
const Layout = styled("div", {
  base: {
    display: "flex",
    height: "100%",
    minWidth: 0,
    backgroundImage: "none",
    // the frame behind the panels (top bar and server rail sit on it)
    backgroundColor: "var(--z-bg-frame, var(--md-sys-color-surface))",
    backgroundRepeat: "no-repeat",
    // phones: the menu side is positioned inside this box, below the top bar
    _phone: { position: "relative" },
  },
  variants: {
    disconnected: {
      true: {
        color: "var(--md-sys-color-on-primary-container)",
        background: "var(--md-sys-color-primary-container)",
        backgroundImage: "none",
      },
      false: {
        color: "var(--z-fg-muted, var(--md-sys-color-outline))",
      },
    },
  },
});

/**
 * Main content container
 */
const Content = styled("div", {
  base: {
    // chat + member list: same surface as channel header / members (no wash)
    background: "var(--z-bg-shell, var(--z-bg-chat))",
    borderTop: "1px solid var(--z-border-subtle)",
    display: "flex",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    _phone: {
      background: "var(--z-bg-shell, #1d1f2d)",
      // a tab's page: the tab bar (64px) sits on its bottom edge, the page
      // ends above it, and the bar steps aside while the keyboard is up
      "&[data-tab-page]": {
        position: "relative",
        paddingBottom: "64px",
      },
      "&[data-tab-page]:has(input:focus, textarea:focus, [contenteditable='true']:focus)":
        {
          paddingBottom: 0,
          "& > [data-phone-tabs-page]": { display: "none" },
        },
    },
  },
  variants: {
    sidebar: {
      // no channel list: this panel meets the rail itself, so it takes the
      // rounded top corner and the hairline the channel list would have
      false: {
        paddingInlineStart: 0,
        borderRadius: 0,
        borderStartStartRadius: "var(--z-radius-md, 10px)",
        borderInlineStart: "1px solid var(--z-border-subtle)",
        overflow: "hidden",

        _phone: {
          borderStartStartRadius: 0,
          borderInlineStart: "none",
        },

        _tablet: {
          paddingInlineStart: 0,
        },
      },
    },
  },
});

export default Interface;
