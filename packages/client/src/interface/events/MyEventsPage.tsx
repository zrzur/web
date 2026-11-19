import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { TranslatedError } from "@revolt/i18n/errors";
import { Navigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Button, EmptyState, Header } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { HeaderIcon } from "../common/CommonHeader";
import {
  ListDivider,
  ListPhoneFilters,
  ListSpacer,
  ListTab,
  ListTabs,
} from "../common/ListPageHeader";

import { type PlaceFilter, eventMatches } from "./calendarDays";
import { EventCalendar } from "./EventCalendar";
import { EventCard, EventGroup } from "./EventCard";
import { eventsEnabled } from "./EventsLink";
import { EventFind, NothingFound } from "./EventsPage";

type Which = "mine" | "all" | "calendar";

/**
 * Your events in every server at once, soonest first: the ones you answered
 * Going or Maybe to, or everything coming up that you may see. Each card
 * names its server and opens the event there.
 */
export function MyEventsPage() {
  const { t } = useLingui();
  const client = useClient();
  const state = useState();
  const { layout } = useDevice();
  // phones and narrow tablets: the tabs and the search get their own rows
  const phone = () => layout() !== "desktop";
  const [which, setWhich] = createSignal<Which>("mine");
  const [search, setSearch] = createSignal("");
  const [place, setPlace] = createSignal<PlaceFilter>("any");
  const found = (event: API.ServerEvent) =>
    eventMatches(event, search(), place());

  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 30_000);
  onCleanup(() => clearInterval(timer));

  const [loaded, { refetch }] = createResource(
    () => (eventsEnabled(client()) ? "go" : undefined),
    async () => {
      const mine = await client().serverEvents.fetchMine({ limit: 200 });
      return mine.events.map((event) => event._id);
    },
  );

  /** Your part in an event, as it stands now (answers change while open) */
  const takingPart = (event: API.ServerEvent) => {
    const answer = client().serverEvents.answerOf(event._id);
    return !!answer && answer.answer !== "NotGoing";
  };
  const events = () =>
    (loaded.latest ?? [])
      .map((id) => client().serverEvents.get(id))
      .filter(
        (event): event is API.ServerEvent =>
          !!event &&
          (event.status === "Scheduled" || event.status === "Active") &&
          !!client().servers.get(event.server),
      );
  const shown = () =>
    (which() === "mine" ? events().filter(takingPart) : events()).filter(found);
  const all = () =>
    which() === "mine" ? events().filter(takingPart) : events();

  const tabsEl = () => (
    <ListTabs role="tablist" aria-label={t`Which events`}>
      <ListTab
        type="button"
        role="tab"
        aria-selected={which() === "mine"}
        onClick={() => setWhich("mine")}
        data-testid="my-events-tab-mine"
      >
        <Trans>I'm taking part</Trans>
      </ListTab>
      <ListTab
        type="button"
        role="tab"
        aria-selected={which() === "all"}
        onClick={() => setWhich("all")}
        data-testid="my-events-tab-all"
      >
        <Trans>Everything coming up</Trans>
      </ListTab>
      <ListTab
        type="button"
        role="tab"
        aria-selected={which() === "calendar"}
        onClick={() => setWhich("calendar")}
        data-testid="my-events-tab-calendar"
      >
        <Trans context="scheduled events">Calendar</Trans>
      </ListTab>
    </ListTabs>
  );
  const findEl = () => (
    <EventFind
      search={search()}
      onSearch={setSearch}
      place={place()}
      onPlace={setPlace}
    />
  );

  return (
    <Show when={eventsEnabled(client())} fallback={<Navigate href="/" />}>
      <Page data-testid="my-events-page">
        <Header placement="primary">
          <Title>
            <Show
              when={state.appDrawer()}
              fallback={<Icon name="calendar" size={20} />}
            >
              <HeaderIcon>
                <Icon name="calendar" size={20} />
              </HeaderIcon>
            </Show>
            <h1>
              <Trans>My events</Trans>
            </h1>
          </Title>
          <Show when={!phone()}>
            <ListDivider />
            {tabsEl()}
            <ListSpacer />
            {findEl()}
          </Show>
        </Header>
        {/* phones: the tabs and the search get their own rows under the title */}
        <Show when={phone()}>
          <ListPhoneFilters>
            {tabsEl()}
            {findEl()}
          </ListPhoneFilters>
        </Show>
        <Body>
          <Switch>
            <Match when={which() === "calendar"}>
              <EventCalendar
                load={async (from, to) =>
                  (
                    await client().serverEvents.fetchMine({
                      from,
                      to,
                      limit: 200,
                    })
                  ).events
                }
                filter={(event) =>
                  found(event) && !!client().servers.get(event.server)
                }
                day={(list) => (
                  <EventGroup>
                    <For each={list}>
                      {(event) => (
                        <EventCard
                          event={event}
                          server={client().servers.get(event.server)!}
                          now={now()}
                          showServer
                        />
                      )}
                    </For>
                  </EventGroup>
                )}
              />
            </Match>
            <Match when={loaded.error}>
              <Problem role="alert">
                <strong>
                  <Trans>The events could not be loaded.</Trans>
                </strong>
                <TranslatedError error={loaded.error} />
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={() => void refetch()}
                >
                  <Trans>Try again</Trans>
                </Button>
              </Problem>
            </Match>
            <Match when={loaded.loading && !loaded.latest}>
              <Grid aria-busy="true" aria-label={t`Loading events`}>
                <For each={[0, 1, 2]}>
                  {() => <SkeletonCard aria-hidden="true" />}
                </For>
              </Grid>
            </Match>
            <Match when={shown().length}>
              <EventGroup>
                <For each={shown()}>
                  {(event) => (
                    <EventCard
                      event={event}
                      server={client().servers.get(event.server)!}
                      now={now()}
                      showServer
                    />
                  )}
                </For>
              </EventGroup>
            </Match>
            <Match when={all().length}>
              <NothingFound />
            </Match>
            <Match when={which() === "mine"}>
              <EmptyState
                art="communities"
                title={t`You are not taking part in any event yet`}
                description={t`Answer Going or Maybe to an event in any of your servers and it is kept here.`}
                action={
                  <Show when={events().length}>
                    <Button variant="tonal" onPress={() => setWhich("all")}>
                      <Trans>See everything coming up</Trans>
                    </Button>
                  </Show>
                }
              />
            </Match>
            <Match when={true}>
              <EmptyState
                art="communities"
                title={t`Nothing is planned in your servers`}
                description={t`Events of the next 90 days in servers that use events show up here.`}
              />
            </Match>
          </Switch>
        </Body>
      </Page>
    </Show>
  );
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
    flex: "0 1 auto",
    minWidth: 0,
    "--z-icon-color": "var(--z-fg-secondary)",
    "& h1": {
      margin: 0,
      minWidth: 0,
      fontSize: "18px",
      fontWeight: 650,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
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
    maxWidth: "1008px",
    marginInline: "auto",
    padding: "24px",
    _phone: { padding: "12px 16px" },
  },
});

const Grid = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
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
    height: "112px",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-raised)",
    animation: "pulse 1.6s ease-in-out infinite",
    _motionReduce: { animation: "none" },
  },
});
