import { Show, createEffect, on, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { type Client, type Server, serverEventLink } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { A, useLocation, useNavigate } from "@revolt/routing";
import { Icon } from "@revolt/ui/icons/Icon";

import { JoinButton } from "./EventCard";
import { isEventsShortcut } from "./eventFormat";

/** Whether this Zrzur node has scheduled events switched on */
export function eventsEnabled(client?: Client): boolean {
  return client?.configuration?.features?.server_events === true;
}

/**
 * "Events" row at the top of a server's channel list, with the number of
 * events coming up, and the "Happening now" banner under it while one
 * runs. Alt+Shift+E opens the events while the server is open.
 */
export function EventsLink(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const location = useLocation();
  const navigate = useNavigate();
  const href = () => `/server/${props.server.id}/events`;

  // load once per server; the gateway keeps the list current afterwards
  createEffect(
    on(
      () => [props.server.id, eventsEnabled(client())] as const,
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
    if (!isEventsShortcut(event) || !eventsEnabled(client())) return;
    event.preventDefault();
    navigate(href());
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  return (
    <Show when={eventsEnabled(client())}>
      <Row
        href={href()}
        aria-current={
          location.pathname.includes("/events") ? "page" : undefined
        }
        aria-keyshortcuts="Alt+Shift+E"
        data-testid="events-link"
      >
        <Icon name="calendar" size={20} />
        <span>{t({ message: "Events", context: "scheduled events" })}</span>
        <Show when={count()}>
          <Count
            data-testid="events-count"
            aria-label={t`${count()} upcoming`}
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
            <BannerTitle href={`${href()}/${event()._id}`}>
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
    gap: "10px",
    minHeight: "36px",
    marginInline: "8px",
    marginBlock: "8px 2px",
    paddingInline: "10px",
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
    "& > span:first-of-type": { flex: 1, minWidth: 0 },
    _phone: { minHeight: "44px" },
  },
});

const Count = styled("span", {
  base: {
    minWidth: "20px",
    height: "20px",
    paddingInline: "6px",
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
    gap: "6px",
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
