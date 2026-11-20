import { Show, createEffect, on, onCleanup } from "solid-js";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import {
  type Client,
  type Server,
  serverEventChannel,
  serverEventLink,
} from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { deviceMac } from "@revolt/keybinds/active";
import { ariaKeys } from "@revolt/keybinds/keyLabels";
import { isMac, isTypingTarget } from "@revolt/keybinds/shortcuts";
import { useModals } from "@revolt/modal";
import { A, useLocation, useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Icon } from "@revolt/ui/icons/Icon";

import { JoinButton } from "./EventCard";
import { eventsShortcutAllowed, isEventsShortcut } from "./eventFormat";

/** Whether this Zrzur node has scheduled events switched on */
export function eventsEnabled(client?: Client): boolean {
  return client?.configuration?.features?.server_events === true;
}

/**
 * Events show in a server only when the node has them and a manager turned
 * them on for this server (off in every new server)
 */
export function serverEventsOn(
  client: Client | undefined,
  server: Pick<Server, "eventsEnabled"> | undefined,
): boolean {
  return eventsEnabled(client) && server?.eventsEnabled === true;
}

/**
 * "Events" row at the top of a server's channel list, with the number of
 * events coming up, and the "Happening now" banner under it while one
 * runs; only in a server whose managers turned events on. Ctrl+Shift+9
 * opens the events while the server is open (not while typing or with a
 * dialog open).
 */
export function EventsLink(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const location = useLocation();
  const navigate = useNavigate();
  const modals = useModals();
  const state = useState();
  // phones: like a channel, opening the events slides the channel list away
  const showContent = () => state.appDrawer()?.setShown(true);
  const href = () => `/server/${props.server.id}/events`;
  const shown = () => serverEventsOn(client(), props.server);

  // load once per server; the gateway keeps the list current afterwards
  createEffect(
    on(
      () => [props.server.id, shown()] as const,
      ([id, enabled]) => {
        if (enabled && !client().serverEvents.isLoaded(id))
          void client()
            .serverEvents.fetchForServer(id)
            .catch(() => undefined);
      },
    ),
  );

  const events = () => client().serverEvents.forServer(props.server.id);
  const count = () => events().length;
  const live = () => events().find((event) => event.status === "Active");
  /** The channel the live event runs in, by its name; none for a link */
  const placeName = (event: ReturnType<typeof events>[number]) => {
    const id = serverEventChannel(event.place);
    return id ? client().channels.get(id)?.name : undefined;
  };

  const onKey = (event: KeyboardEvent) => {
    if (!isEventsShortcut(event, isMac()) || !shown()) return;
    const dialogOpen =
      modals.isOpen() ||
      !!document.querySelector("[role=dialog][aria-modal=true]");
    if (!eventsShortcutAllowed(isTypingTarget(event.target), dialogOpen))
      return;
    event.preventDefault();
    navigate(href());
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  return (
    <Show when={shown()}>
      <Row
        href={href()}
        aria-current={
          location.pathname.includes("/events") ? "page" : undefined
        }
        aria-keyshortcuts={ariaKeys(
          state.keybinds.table().byId["open_events"],
          deviceMac(),
        )}
        data-testid="events-link"
        onClick={showContent}
      >
        <Icon name="calendar" size={20} />
        <Label>{t({ message: "Events", context: "scheduled events" })}</Label>
        <Show when={count()}>
          <Count
            data-testid="events-count"
            aria-label={t`${plural(count(), {
              one: "# upcoming event",
              other: "# upcoming events",
            })}`}
            data-live={live() ? "" : undefined}
          >
            {count()}
          </Count>
        </Show>
      </Row>
      <Show when={live()}>
        {(event) => (
          <Banner data-testid="event-banner" aria-live="polite">
            <BannerText>
              <BannerTitle
                href={`${href()}/${event()._id}`}
                onClick={showContent}
              >
                {event().title}
              </BannerTitle>
              <BannerHead>
                <LiveDot aria-hidden="true" />
                <span>
                  <Trans>Happening now</Trans>
                </span>
                <Show when={placeName(event())}>
                  {(name) => <Place>· {name()}</Place>}
                </Show>
              </BannerHead>
            </BannerText>
            <JoinButton
              event={event()}
              server={props.server}
              link={serverEventLink(event().place)}
            />
          </Banner>
        )}
      </Show>
    </Show>
  );
}

const Row = styled(A, {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    // the same row as a channel: height and the 8 px padding that puts the
    // icon on the list's start line
    minHeight: "var(--z-row-height, 34px)",
    marginInline: "8px",
    // the same spacing as the Lobby and Rules rows under it
    marginBlock: "2px",
    "&:first-child": { marginBlockStart: "8px" },
    paddingInline: "8px",
    borderRadius: "8px",
    color: "var(--z-fg-secondary)",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[aria-current=page]": {
      background: "var(--z-nav-active)",
      color: "var(--z-fg-primary)",
    },
    _phone: { minHeight: "44px" },
  },
});

/** The row's name takes the free space; the icon keeps its size */
const Label = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Count = styled("span", {
  base: {
    minWidth: "20px",
    height: "20px",
    paddingInline: "8px",
    borderRadius: "999px",
    display: "inline-grid",
    placeItems: "center",
    fontSize: "12px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
  },
});

/**
 * The live event as one Settings group: the same surface, border and corners
 * as the groups in Settings, no colour of its own; only the dot says "live".
 * Name and place on the start side, the one action on the end side.
 */
const Banner = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginInline: "8px",
    marginBlock: "4px 8px",
    padding: "12px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
  },
});

const BannerText = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

const BannerHead = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--z-fg-secondary)",
    whiteSpace: "nowrap",
  },
});

const Place = styled("span", {
  base: { overflow: "hidden", textOverflow: "ellipsis" },
});

const LiveDot = styled("span", {
  base: {
    flexShrink: 0,
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "var(--z-live)",
  },
});

const BannerTitle = styled(A, {
  base: {
    maxWidth: "100%",
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    textDecoration: "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    _hover: { textDecoration: "underline" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});
