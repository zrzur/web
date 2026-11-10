import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { type Server, isUpcoming } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { useModals } from "@revolt/modal";
import { Navigate, useParams } from "@revolt/routing";
import { Button, EmptyState, Header } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { EventCard } from "./EventCard";
import { eventsEnabled, serverEventsOn } from "./EventsLink";

/**
 * A server's events: what is happening now and what is coming up, with
 * a card for each. Opened from the Events row at the top of the channel
 * list, with Alt+Shift+E, or from a shared link (`/events/<id>`), which
 * also shows a past or cancelled event.
 */
export function EventsPage() {
  const params = useParams();
  const client = useClient();
  const server = createMemo(() => client()!.servers.get(params.server));

  return (
    <Show
      when={server() && eventsEnabled(client())}
      fallback={<Navigate href={server() ? `/server/${params.server}` : "/"} />}
    >
      <Show
        when={serverEventsOn(client(), server())}
        fallback={<EventsOff server={server()!} />}
      >
        <Events server={server()!} focus={params.event} />
      </Show>
    </Show>
  );
}

/**
 * The events page of a server whose managers have not turned events on:
 * one plain line, and for managers the way to the switch
 */
export function EventsOff(props: { server: Server }) {
  const { t } = useLingui();
  const { openModal } = useModals();
  const canManage = () => props.server.havePermission("ManageServer");

  return (
    <Page data-testid="events-off">
      <Header placement="primary">
        <Title>
          <Icon name="calendar" size={20} />
          <h1>{t({ message: "Events", context: "scheduled events" })}</h1>
        </Title>
      </Header>
      <Body>
        <Off>
          <p>
            <Trans>Events are off in this server.</Trans>
          </p>
          <Show when={canManage()}>
            <Button
              size="sm"
              variant="filled"
              data-testid="events-off-settings"
              onPress={() =>
                openModal({
                  type: "settings",
                  config: "server",
                  initialPage: "events",
                  context: props.server,
                })
              }
            >
              <Trans>Open server settings</Trans>
            </Button>
          </Show>
        </Off>
      </Body>
    </Page>
  );
}

function Events(props: { server: Server; focus?: string }) {
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();

  // "starts in 5 minutes" stays right while the page is open
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 30_000);
  onCleanup(() => clearInterval(timer));

  const [loaded, { refetch }] = createResource(
    () => props.server.id,
    (id) => client().serverEvents.fetchForServer(id),
  );
  // a shared link may point at an event that is over or not in the list
  const [focused] = createResource(
    () => props.focus,
    async (id) => {
      const known = client().serverEvents.get(id);
      return known ?? client().serverEvents.fetch(props.server.id, id);
    },
  );

  const events = () => client().serverEvents.forServer(props.server.id);
  const live = () => events().filter((event) => event.status === "Active");
  const upcoming = () =>
    events().filter((event) => event.status === "Scheduled");
  const focusedPast = () => {
    const event = focused.latest;
    return event && !isUpcoming(client().serverEvents.get(event._id) ?? event)
      ? (client().serverEvents.get(event._id) ?? event)
      : undefined;
  };
  const canManage = () => props.server.havePermission("ManageServer");
  const schedule = () =>
    openModal({ type: "server_event", server: props.server });

  return (
    <Page data-testid="events-page">
      <Header placement="primary">
        <Title>
          <Icon name="calendar" size={20} />
          <h1>{t({ message: "Events", context: "scheduled events" })}</h1>
        </Title>
        <Show when={canManage()}>
          <Button
            size="sm"
            variant="filled"
            onPress={schedule}
            data-testid="events-schedule"
          >
            <Icon name="plus" size={16} />
            <Trans>Schedule event</Trans>
          </Button>
        </Show>
      </Header>
      <Body>
        <Switch>
          <Match when={loaded.error}>
            <Problem role="alert" data-testid="events-error">
              <strong>
                <Trans>The events could not be loaded.</Trans>
              </strong>
              <TranslatedError error={loaded.error} />
              <Button size="sm" variant="tonal" onPress={() => void refetch()}>
                <Trans>Try again</Trans>
              </Button>
            </Problem>
          </Match>
          <Match
            when={
              loaded.loading && !client().serverEvents.isLoaded(props.server.id)
            }
          >
            <List aria-busy="true" aria-label={t`Loading events`}>
              <For each={[0, 1]}>{() => <Skeleton />}</For>
            </List>
          </Match>
          <Match when={true}>
            <Show when={focusedPast()}>
              {(event) => (
                <Section>
                  <SectionTitle>
                    {event().status === "Cancelled"
                      ? t({ message: "Cancelled", context: "scheduled events" })
                      : t`This event is over`}
                  </SectionTitle>
                  <EventCard
                    event={event()}
                    server={props.server}
                    now={now()}
                    highlighted
                  />
                </Section>
              )}
            </Show>
            <Show when={focused.error}>
              <Problem role="alert">
                <strong>
                  <Trans>
                    This event is not there any more, or you can't see where it
                    takes place.
                  </Trans>
                </strong>
                <TranslatedError error={focused.error} />
              </Problem>
            </Show>
            <Show when={live().length}>
              <Section aria-labelledby="events-live">
                <SectionTitle id="events-live" data-live>
                  <Trans>Happening now</Trans>
                </SectionTitle>
                <List>
                  <For each={live()}>
                    {(event) => (
                      <EventCard
                        event={event}
                        server={props.server}
                        now={now()}
                        highlighted={event._id === props.focus}
                      />
                    )}
                  </For>
                </List>
              </Section>
            </Show>
            <Show
              when={upcoming().length}
              fallback={
                <Show when={!live().length}>
                  <EmptyState
                    art="communities"
                    title={t`No events planned yet`}
                    description={
                      canManage()
                        ? t`Plan a game night, a talk or a meetup. Members can mark it Interested and hear when it starts.`
                        : t`When the managers plan something, it shows up here.`
                    }
                    action={
                      <Show when={canManage()}>
                        <Button variant="filled" onPress={schedule}>
                          <Trans>Schedule event</Trans>
                        </Button>
                      </Show>
                    }
                  />
                </Show>
              }
            >
              <Section aria-labelledby="events-upcoming">
                <SectionTitle id="events-upcoming">
                  <Trans>Upcoming</Trans>
                </SectionTitle>
                <List>
                  <For each={upcoming()}>
                    {(event) => (
                      <EventCard
                        event={event}
                        server={props.server}
                        now={now()}
                        highlighted={event._id === props.focus}
                      />
                    )}
                  </For>
                </List>
              </Section>
            </Show>
          </Match>
        </Switch>
      </Body>
    </Page>
  );
}

/** A card while the list loads */
function Skeleton() {
  return <SkeletonCard aria-hidden="true" />;
}

const Page = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    height: "100%",
    background: "var(--z-bg-chat)",
    color: "var(--z-fg-primary)",
  },
});

const Title = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: 0,
    "--z-icon-color": "var(--z-fg-secondary)",
    "& h1": {
      margin: 0,
      fontSize: "18px",
      fontWeight: 650,
    },
  },
});

const Body = styled("div", {
  base: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    width: "100%",
    maxWidth: "920px",
    marginInline: "auto",
    padding: "24px",
    _phone: { padding: "12px 16px" },
  },
});

const Off = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-raised)",
    fontSize: "15px",
    lineHeight: "24px",
    "& p": { margin: 0 },
  },
});

const Section = styled("section", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const SectionTitle = styled("h2", {
  base: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 650,
    color: "var(--z-fg-secondary)",
    "&[data-live]": { color: "var(--z-live)" },
  },
});

const List = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const Problem = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    padding: "16px",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "color-mix(in srgb, var(--z-danger) 10%, var(--z-bg-raised))",
    fontSize: "14px",
    lineHeight: "20px",
  },
});

const SkeletonCard = styled("div", {
  base: {
    height: "180px",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-raised)",
    animation: "pulse 1.6s ease-in-out infinite",
    _motionReduce: { animation: "none" },
  },
});
