import { Show, createEffect, on, onCleanup } from "solid-js";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import { type Client, type Server, serverEventLink } from "@zrzur/sdk/solid";
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
            <BannerHead>
              <LiveDot aria-hidden="true" />
              <Trans>Happening now</Trans>
            </BannerHead>
            <BannerTitle
              href={`${href()}/${event()._id}`}
              onClick={showContent}
            >
              {event().title}
            </BannerTitle>
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
    minHeight: "36px",
    marginInline: "8px",
    marginBlock: "8px 4px",
    paddingInline: "12px",
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
    "&[data-live]": {
      background: "color-mix(in srgb, var(--z-live) 20%, transparent)",
      color: "var(--z-live)",
    },
  },
});

const Banner = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    marginInline: "8px",
    marginBlock: "4px 8px",
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "color-mix(in srgb, var(--z-live) 10%, var(--z-bg-raised))",
    border: "1px solid color-mix(in srgb, var(--z-live) 35%, transparent)",
  },
});

const BannerHead = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-live)",
  },
});

const LiveDot = styled("span", {
  base: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "currentColor",
  },
});

const BannerTitle = styled(A, {
  base: {
    maxWidth: "100%",
    fontSize: "14px",
    fontWeight: 650,
    color: "var(--z-fg-primary)",
    textDecoration: "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    _hover: { textDecoration: "underline" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});
