import {
  createEffect,
  createSignal,
  JSX,
  Match,
  on,
  onCleanup,
  Show,
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

/** Longest wait for unread state before Home draws without it */
const UNREADS_WAIT = 800;

/**
 * Application layout
 */
const Interface = (props: { children?: JSX.Element }) => {
  const state = useState();
  const client = useClient();
  const { openModal } = useModals();
  const { isLoggedIn, lifecycle } = useClientLifecycle();
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
              </Content>
            </Layout>
          </Match>
        </Switch>

        <NotificationsWorker />
        {/* plugins load lazily, for a signed-in user, if the server has them on */}
        <Show when={isLoggedIn()}>
          <ChangeRequestNotice />
          <NoticeCenter />
        </Show>
        <Show when={isLoggedIn()}>
          <PluginHostGate />
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
    },
  },
  variants: {
    sidebar: {
      // no channel list: this panel meets the rail itself, so it takes the
      // rounded top corner and the hairline the channel list would have
      false: {
        paddingLeft: 0,
        borderRadius: 0,
        borderStartStartRadius: "var(--z-radius-md, 10px)",
        borderInlineStart: "1px solid var(--z-border-subtle)",
        overflow: "hidden",

        _phone: {
          borderStartStartRadius: 0,
          borderInlineStart: "none",
        },

        _tablet: {
          paddingLeft: 0,
        },
      },
    },
  },
});

export default Interface;
