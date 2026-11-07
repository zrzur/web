import {
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient, useClientLifecycle } from "@revolt/client";
import { State, TransitionType } from "@revolt/client/Controller";
import { useLocation, useSmartParams } from "@revolt/routing";
import { Avatar, Button } from "@revolt/ui";
import { Icon, IconName } from "@revolt/ui/icons/Icon";

import { pendingUpdate } from "../../../../src/serviceWorkerInterface";
import titlebarMark from "./titlebar-mark.png?url";

const isMacOS = navigator.platform.startsWith("Mac");
const isNative = !!window.native;

/**
 * Top bar across the whole window, on the frame colour shared with the
 * server rail. Shows where you are (server icon + name, or the page) in the
 * centre, connection problems in place of that title, and on the desktop
 * app the window controls and drag area.
 *
 * @param props.bare Window controls only, no location title (sign-in pages)
 */
export function Titlebar(props: { bare?: boolean }) {
  const [isMaximised, setIsMaximised] = createSignal(
    isNative ? window.desktopConfig.get().windowState.isMaximised : false,
  );
  const { lifecycle } = useClientLifecycle();
  const client = useClient();
  const params = useSmartParams();
  const location = useLocation();
  const { t } = useLingui();

  // the browser knows the network is gone before the socket gives up
  const [online, setOnline] = createSignal(navigator.onLine);
  const goOnline = () => setOnline(true);
  const goOffline = () => setOnline(false);
  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  onCleanup(() => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
  });

  function isDisconnected() {
    if (!online()) return true;
    return [
      State.Connecting,
      State.Disconnected,
      State.Reconnecting,
      State.Offline,
    ].includes(lifecycle.state());
  }

  // phones: the bar only appears with news. "Connecting…" at app start
  // usually lasts a moment; showing the bar for it would push the whole screen
  // down and back up. A lasting problem (offline, disconnected, connecting for
  // over 1.5 s) or an update waiting shows it.
  const [phoneShow, setPhoneShow] = createSignal(false);
  createEffect(() => {
    const state = lifecycle.state();
    setPhoneShow(false);
    if (!isDisconnected()) return;
    if (!online()) return setPhoneShow(true);
    if (state !== State.Connecting && state !== State.Reconnecting)
      return setPhoneShow(true);
    const timer = setTimeout(() => setPhoneShow(true), 1500);
    onCleanup(() => clearTimeout(timer));
  });

  function maximise() {
    window.native.maximise();
    setIsMaximised((t) => !t);
  }

  /** What the centre of the bar shows for the current route */
  const context = createMemo(
    (): { name: string; image?: string; icon?: IconName } => {
      const c = client();
      const { serverId, channelId } = params();
      const server = serverId ? c?.servers.get(serverId) : undefined;
      if (server) return { name: server.name, image: server.animatedIconURL };

      const channel = channelId ? c?.channels.get(channelId) : undefined;
      if (channel) {
        return channel.type === "SavedMessages"
          ? { name: t`Saved notes`, icon: "notebook" }
          : { name: channel.displayName ?? "", image: channel.animatedIconURL };
      }

      if (location.pathname.startsWith("/friends"))
        return { name: t`Friends`, icon: "users" };
      if (location.pathname.startsWith("/discover"))
        return { name: t`Discover`, icon: "compass" };
      if (location.pathname.startsWith("/designs"))
        return { name: t`Designs`, icon: "palette" };
      if (location.pathname.startsWith("/you"))
        return { name: t`You`, icon: "user-circle" };
      return { name: t`Home`, icon: "house" };
    },
  );

  return (
    <Base
      data-desktop-titlebar
      data-disconnected={isDisconnected()}
      data-native={isNative}
      data-phone-show={phoneShow() || !!pendingUpdate()}
      style={{ "-webkit-user-select": "none", "-webkit-app-region": "drag" }}
    >
      {/* room for the macOS traffic lights */}
      <Side data-macos={isMacOS && isNative}>
        <Show when={isNative}>
          <img
            src={titlebarMark}
            alt="Zrzur"
            width={24}
            height={24}
            draggable={false}
            style={{
              "object-fit": "contain",
              "border-radius": "50%",
              "margin-inline": "12px",
              "flex-shrink": 0,
            }}
          />
        </Show>
      </Side>

      <Centre>
        <Show when={!props.bare}>
          <Switch
            fallback={
              <Context>
                <Show
                  when={context().image !== undefined || !context().icon}
                  fallback={<Icon name={context().icon!} size={16} />}
                >
                  <Avatar
                    size={18}
                    src={context().image}
                    fallback={context().name}
                    shape="rounded-square"
                  />
                </Show>
                <span>{context().name}</span>
              </Context>
            }
          >
            <Match when={!online()}>
              <Status>
                {t`Device is offline`}
                <a
                  style={{ "-webkit-app-region": "no-drag" }}
                  onClick={() =>
                    lifecycle.transition({ type: TransitionType.Retry })
                  }
                >
                  {t`Reconnect now`}
                </a>
              </Status>
            </Match>
            <Match when={lifecycle.state() === State.Connecting}>
              <Status>{t`Connecting…`}</Status>
            </Match>
            <Match when={lifecycle.state() === State.Reconnecting}>
              <Status>{t`Reconnecting…`}</Status>
            </Match>
            <Match
              when={
                lifecycle.state() === State.Disconnected ||
                lifecycle.state() === State.Offline
              }
            >
              <Status>
                {lifecycle.state() === State.Offline
                  ? t`Device is offline`
                  : t`Disconnected`}
                <a
                  style={{ "-webkit-app-region": "no-drag" }}
                  onClick={() =>
                    lifecycle.transition({ type: TransitionType.Retry })
                  }
                >
                  {t`Reconnect now`}
                </a>
              </Status>
            </Match>
          </Switch>
        </Show>
      </Centre>

      <Side data-end>
        <Show when={pendingUpdate()}>
          <div style={{ "-webkit-app-region": "no-drag" }}>
            <Button size="xs" onPress={pendingUpdate()}>
              Update
            </Button>
          </div>
        </Show>
        <Show when={isNative && !isMacOS}>
          <Action
            aria-label={t`Minimise`}
            style={{ "-webkit-app-region": "no-drag" }}
            onClick={window.native.minimise}
          >
            <Icon name="minus" size={16} />
          </Action>
          <Action
            aria-label={isMaximised() ? "Restore" : "Maximise"}
            style={{ "-webkit-app-region": "no-drag" }}
            onClick={maximise}
          >
            <Show
              when={isMaximised()}
              fallback={<Icon name="square" size={14} />}
            >
              <Icon name="window-restore" size={14} />
            </Show>
          </Action>
          <Action
            data-close
            aria-label={t`Close`}
            style={{ "-webkit-app-region": "no-drag" }}
            onClick={window.native.close}
          >
            <Icon name="x" size={16} />
          </Action>
        </Show>
      </Side>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    flexShrink: 0,
    position: "relative",
    zIndex: 100,
    direction: "ltr",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    height: "var(--z-titlebar-height, 32px)",
    userSelect: "none",
    // the frame: same colour as the server rail
    background: "var(--z-bg-frame)",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-icon-muted)",

    "&[data-disconnected='true']": {
      background:
        "color-mix(in srgb, var(--z-status-warning) 18%, var(--z-bg-frame))",
    },

    // phones in the browser: the channel and page headers already say where
    // you are, so the bar only appears for a connection problem (the 32 px
    // go to the chat), tall enough to tap "Reconnect now"
    _phone: {
      "&[data-disconnected='true']": { minHeight: "44px" },
      // the status line is the whole bar: full width, in the reading direction
      "&:not([data-native='true'])": {
        direction: "inherit",
        height: "auto",
        display: "flex",
        justifyContent: "center",
        gap: "12px",
        paddingInline: "12px",
      },
      "&:not([data-native='true']):not([data-phone-show='true'])": {
        display: "none",
      },
    },
  },
});

const Side = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    minWidth: 0,

    "&[data-macos='true']": {
      minWidth: "76px",
    },
    "&[data-end]": {
      justifyContent: "flex-end",
      gap: "6px",
    },
  },
});

const Centre = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    maxWidth: "50vw",
    _phone: { maxWidth: "none" },
  },
});

const Context = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",

    "& > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Status = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    _phone: {
      flexWrap: "wrap",
      justifyContent: "center",
      textAlign: "center",
      columnGap: "8px",
    },

    "& a": {
      cursor: "pointer",
      color: "var(--z-accent-text, var(--z-accent))",
      textDecoration: "underline",
      _phone: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: "44px",
        paddingInline: "8px",
      },
    },
  },
});

const Action = styled("a", {
  base: {
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    height: "100%",
    width: "44px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    transition: "background-color 0.1s ease",

    _hover: {
      background: "var(--z-nav-hover)",
      color: "var(--z-fg-primary)",
    },
    "&[data-close]:hover": {
      background: "#E81123",
      color: "#fff",
    },
  },
});
