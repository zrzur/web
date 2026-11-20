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
import type { Server } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "@revolt/app/menus/ContextMenu";
import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { isTypingTarget } from "@revolt/keybinds/shortcuts";
import { useModals } from "@revolt/modal";
import { Navigate, useNavigate, useParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Button, EmptyState, Header } from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";
import type { IconName } from "@revolt/ui/icons/registry";

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
import { EventCard, EventGroup, EventHero } from "./EventCard";
import { EventDetail } from "./EventDetail";
import { eventKey, eventWhen, eventsShortcutAllowed } from "./eventFormat";
import { eventsEnabled, serverEventsOn } from "./EventsLink";
import { settled } from "./settled";

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
  const { t, i18n } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const navigate = useNavigate();
  const state = useState();
  const { layout } = useDevice();
  // phones and narrow tablets: the tabs and the search get their own rows
  // under the title, as on Friends
  const phone = () => layout() !== "desktop";

  // "starts in 5 minutes" stays right while the page is open
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 30_000);
  onCleanup(() => clearInterval(timer));

  const canManage = () => props.server.havePermission("ManageEvents");
  const [tab, setTab] = createSignal<
    "upcoming" | "mine" | "calendar" | "past" | "drafts"
  >("upcoming");
  const [search, setSearch] = createSignal("");
  const [place, setPlace] = createSignal<PlaceFilter>("any");
  const found = (event: Parameters<typeof eventMatches>[0]) =>
    eventMatches(event, search(), place());
  const finding = () => search().trim() !== "" || place() !== "any";
  const [loaded, { refetch }] = createResource(
    () => [props.server.id, canManage()] as const,
    ([id, drafts]) => client().serverEvents.fetchForServer(id, { drafts }),
  );
  // the last three months, loaded when the tab is first opened
  const [past] = createResource(
    () => (tab() === "past" ? props.server.id : undefined),
    async (id) => {
      const to = new Date();
      const from = new Date(to.getTime() - 92 * 24 * 60 * 60_000);
      const list = await client().serverEvents.fetchRange(
        id,
        from.toISOString(),
        to.toISOString(),
      );
      return list
        .filter(
          (event) =>
            event.status === "Completed" || event.status === "Cancelled",
        )
        .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
    },
  );
  // a shared link may point at an event that is over or not in the list
  const [focused] = createResource(
    () => props.focus,
    async (id) => {
      // always asked for: the answer says whether you may run this event
      return client().serverEvents.fetch(props.server.id, id);
    },
  );

  const events = () => client().serverEvents.forServer(props.server.id);
  const live = () => events().filter((event) => event.status === "Active");
  const upcoming = () =>
    events().filter((event) => event.status === "Scheduled");
  const drafts = () => client().serverEvents.draftsForServer(props.server.id);
  const mine = () =>
    events().filter((event) => {
      const answer = client().serverEvents.answerOf(event._id);
      return !!answer && answer.answer !== "NotGoing";
    });
  const shown = () => (tab() === "mine" ? mine() : upcoming()).filter(found);
  // the event of the address, once it is known
  const opened = () => {
    if (!props.focus) return undefined;
    return client().serverEvents.get(props.focus) ?? settled(focused);
  };
  const schedule = () =>
    openModal({ type: "server_event", server: props.server });

  // N plans a new event, from the list, for the people who may
  const onKey = (event: KeyboardEvent) => {
    if (eventKey(event) !== "new" || props.focus || !canManage()) return;
    const dialogOpen = !!document.querySelector(
      "[role=dialog][aria-modal=true]",
    );
    if (!eventsShortcutAllowed(isTypingTarget(event.target), dialogOpen))
      return;
    event.preventDefault();
    schedule();
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  // after "Delete this time" the next occurrence takes the card's place and
  // looks the same: a short line says what happened, for a few seconds
  const [deletedOne, setDeletedOne] = createSignal<string>();
  let deletedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(deletedTimer));
  const onDeleted = (info: { id: string; series: boolean }) => {
    clearTimeout(deletedTimer);
    if (info.series) return setDeletedOne(undefined);
    setDeletedOne(info.id);
    deletedTimer = setTimeout(() => setDeletedOne(undefined), 6000);
  };
  const deletedNote = createMemo(() => {
    const id = deletedOne();
    if (!id) return undefined;
    const following = events().find((event) => event.previous === id);
    if (!following) return t`Deleted.`;
    const date = eventWhen(
      following,
      i18n().locale ?? "en",
      hour12From(timeLocale()[1].formats?.LT),
    );
    return t`Deleted. The next one is on ${date}.`;
  });

  const tabsEl = () => (
    <ListTabs role="tablist" aria-label={t`Which events`}>
      <ListTab
        type="button"
        role="tab"
        aria-selected={tab() === "upcoming"}
        onClick={() => setTab("upcoming")}
        data-testid="events-tab-upcoming"
      >
        <Trans>Upcoming</Trans>
      </ListTab>
      <ListTab
        type="button"
        role="tab"
        aria-selected={tab() === "mine"}
        onClick={() => setTab("mine")}
        data-testid="events-tab-mine"
      >
        <Trans>My events</Trans>
      </ListTab>
      <ListTab
        type="button"
        role="tab"
        aria-selected={tab() === "calendar"}
        onClick={() => setTab("calendar")}
        data-testid="events-tab-calendar"
      >
        <Trans context="scheduled events">Calendar</Trans>
      </ListTab>
      <ListTab
        type="button"
        role="tab"
        aria-selected={tab() === "past"}
        onClick={() => setTab("past")}
        data-testid="events-tab-past"
      >
        <Trans>Past</Trans>
      </ListTab>
      <Show when={canManage()}>
        <ListTab
          type="button"
          role="tab"
          aria-selected={tab() === "drafts"}
          onClick={() => setTab("drafts")}
          data-testid="events-tab-drafts"
        >
          <Trans>Drafts</Trans>
        </ListTab>
      </Show>
    </ListTabs>
  );
  const findEl = () => (
    <Show when={tab() !== "drafts"}>
      <EventFind
        search={search()}
        onSearch={setSearch}
        place={place()}
        onPlace={setPlace}
      />
    </Show>
  );

  return (
    <Page data-testid="events-page">
      <Header placement="primary">
        <Title data-grow={props.focus ? "" : undefined}>
          <Show
            when={props.focus}
            fallback={
              // phones: the way back to the channel list
              <Show
                when={state.appDrawer()}
                fallback={<Icon name="calendar" size={20} />}
              >
                <HeaderIcon>
                  <Icon name="calendar" size={20} />
                </HeaderIcon>
              </Show>
            }
          >
            <BackLink
              href={`/server/${props.server.id}/events`}
              onClick={(click) => {
                click.preventDefault();
                navigate(`/server/${props.server.id}/events`);
              }}
              data-testid="events-back"
            >
              <span>
                {t({ message: "Events", context: "scheduled events" })}
              </span>
              <Icon name="caret-right" size={16} />
            </BackLink>
          </Show>
          <h1>
            {opened()?.title ??
              t({ message: "Events", context: "scheduled events" })}
          </h1>
        </Title>
        <Show when={!props.focus && !phone()} fallback={<ListSpacer />}>
          <ListDivider />
          {tabsEl()}
          <ListSpacer />
        </Show>
        <Show when={!props.focus}>{findEl()}</Show>
        <Show when={canManage() && !props.focus}>
          <Button
            size="sm"
            variant={live().length ? "tonal" : "filled"}
            onPress={schedule}
            aria-keyshortcuts="N"
            aria-label={t`New event`}
            data-testid="events-schedule"
          >
            <Icon name="plus" size={16} />
            <WideLabel>
              <Trans>New event</Trans>
            </WideLabel>
          </Button>
        </Show>
      </Header>
      {/* phones: the tabs get their own row under the title */}
      <Show when={!props.focus && phone()}>
        <ListPhoneFilters>{tabsEl()}</ListPhoneFilters>
      </Show>
      <Body data-wide={props.focus ? undefined : true}>
        <Switch>
          <Match when={props.focus}>
            <Switch>
              <Match when={opened()}>
                {(event) => (
                  <EventDetail
                    event={event()}
                    server={props.server}
                    now={now()}
                    onDeleted={onDeleted}
                  />
                )}
              </Match>
              <Match when={focused.error}>
                <Problem role="alert">
                  <strong>
                    <Trans>
                      This event is not there any more, or you can't see where
                      it takes place.
                    </Trans>
                  </strong>
                  <TranslatedError error={focused.error} />
                </Problem>
              </Match>
              <Match when={true}>
                <List aria-busy="true" aria-label={t`Loading events`}>
                  <Skeleton />
                </List>
              </Match>
            </Switch>
          </Match>
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
            <Grid aria-busy="true" aria-label={t`Loading events`}>
              <For each={[0, 1, 2]}>{() => <Skeleton />}</For>
            </Grid>
          </Match>
          <Match when={true}>
            <Show when={deletedNote()}>
              <Note role="status" data-testid="events-deleted-note">
                {deletedNote()}
              </Note>
            </Show>

            <Switch>
              <Match when={tab() === "calendar"}>
                <EventCalendar
                  load={(from, to) =>
                    client().serverEvents.fetchRange(props.server.id, from, to)
                  }
                  filter={found}
                  day={(list) => (
                    <EventGroup>
                      <For each={list}>
                        {(event) => (
                          <EventCard
                            event={event}
                            server={props.server}
                            now={now()}
                          />
                        )}
                      </For>
                    </EventGroup>
                  )}
                />
              </Match>
              <Match when={tab() === "past"}>
                <Switch>
                  <Match when={past.loading}>
                    <Grid aria-busy="true" aria-label={t`Loading events`}>
                      <For each={[0, 1, 2]}>{() => <Skeleton />}</For>
                    </Grid>
                  </Match>
                  <Match when={past.error}>
                    <Problem role="alert">
                      <strong>
                        <Trans>The events could not be loaded.</Trans>
                      </strong>
                      <TranslatedError error={past.error} />
                    </Problem>
                  </Match>
                  <Match when={settled(past)?.filter(found).length}>
                    <EventGroup>
                      <For each={settled(past)?.filter(found)}>
                        {(event) => (
                          <EventCard
                            event={
                              client().serverEvents.get(event._id) ?? event
                            }
                            server={props.server}
                            now={now()}
                          />
                        )}
                      </For>
                    </EventGroup>
                  </Match>
                  <Match when={settled(past)?.length}>
                    <NothingFound />
                  </Match>
                  <Match when={true}>
                    <EmptyState
                      art="communities"
                      title={t`Nothing in the last three months`}
                      description={t`Events that are over or were called off show up here.`}
                    />
                  </Match>
                </Switch>
              </Match>
              <Match when={tab() === "drafts"}>
                <Show
                  when={drafts().length}
                  fallback={
                    <EmptyState
                      art="communities"
                      title={t`No drafts`}
                      description={t`Save an event as a draft to finish it later. Only organisers see drafts.`}
                    />
                  }
                >
                  <EventGroup>
                    <For each={drafts()}>
                      {(event) => (
                        <EventCard
                          event={event}
                          server={props.server}
                          now={now()}
                        />
                      )}
                    </For>
                  </EventGroup>
                </Show>
              </Match>
              <Match when={true}>
                <Show
                  when={tab() === "upcoming" && live().filter(found).length}
                >
                  <EventGroup title={<Trans>Happening now</Trans>}>
                    <For each={live().filter(found)}>
                      {(event) => (
                        <EventHero
                          event={event}
                          server={props.server}
                          now={now()}
                        />
                      )}
                    </For>
                  </EventGroup>
                </Show>
                <Show
                  when={shown().length}
                  fallback={
                    <Show
                      when={!finding()}
                      fallback={
                        <Show
                          when={
                            tab() === "mine" || !live().filter(found).length
                          }
                        >
                          <NothingFound />
                        </Show>
                      }
                    >
                      <Show when={tab() === "mine" || !live().length}>
                        <Show
                          when={tab() === "mine"}
                          fallback={
                            <EmptyState
                              art="communities"
                              title={t`No events planned yet`}
                              description={
                                canManage()
                                  ? t`Plan a game night, a tournament or a meetup. Members answer once and keep their place.`
                                  : t`When the organisers plan something, it shows up here.`
                              }
                              action={
                                <Show when={canManage()}>
                                  <Button variant="filled" onPress={schedule}>
                                    <Trans>New event</Trans>
                                  </Button>
                                </Show>
                              }
                            />
                          }
                        >
                          <EmptyState
                            art="communities"
                            title={t`You have not answered any event here`}
                            description={t`Events you answer Going or Maybe to are kept here.`}
                            action={<AllServersLink />}
                          />
                        </Show>
                      </Show>
                    </Show>
                  }
                >
                  <EventGroup
                    title={
                      tab() === "mine" ? (
                        <Trans>My events</Trans>
                      ) : (
                        <Trans>Upcoming</Trans>
                      )
                    }
                    aside={
                      <Show when={tab() === "mine"}>
                        <AllServersLink />
                      </Show>
                    }
                  >
                    <For each={shown()}>
                      {(event) => (
                        <EventCard
                          event={event}
                          server={props.server}
                          now={now()}
                        />
                      )}
                    </For>
                  </EventGroup>
                </Show>
              </Match>
            </Switch>
          </Match>
        </Switch>
      </Body>
    </Page>
  );
}

/** A search or filter that leaves nothing */
export function NothingFound() {
  return (
    <Note role="status" data-testid="events-nothing-found">
      <Trans>No event matches. Try other words or another place.</Trans>
    </Note>
  );
}

/**
 * Search and the place filter of a list of events, behind one search
 * button in the header (owner, 2026-11-20: the search field took too much
 * room). The button opens a small panel with the search field and the
 * places; on phones the panel is a sheet. Nothing of it shows until the
 * button is pressed; a dot on the button says a search or a place is set.
 */
export function EventFind(props: {
  search: string;
  onSearch: (value: string) => void;
  place: PlaceFilter;
  onPlace: (value: PlaceFilter) => void;
}) {
  const { t } = useLingui();
  const active = () => props.search.trim() !== "" || props.place !== "any";

  return (
    // a real box, so the panel opens under the button (a "contents" wrapper
    // has no place of its own and the panel went to the window's corner)
    <div
      class={css({ display: "inline-flex", flex: "none" })}
      use:floating={{
        contextMenu: () => (
          <FindPanel
            search={props.search}
            onSearch={props.onSearch}
            place={props.place}
            onPlace={props.onPlace}
          />
        ),
        contextMenuHandler: "click",
        contextMenuPlacement: "bottom-end",
      }}
    >
      <Button
        size="sm"
        variant="text"
        aria-haspopup="menu"
        aria-label={
          active()
            ? t`Search and filter events (a filter is set)`
            : t`Search and filter events`
        }
        data-testid="events-find"
        data-active={active() || undefined}
      >
        <FindIcon>
          <Icon name="magnifying-glass" size={18} />
          <Show when={active()}>
            <Chosen aria-hidden="true" data-testid="events-find-set" />
          </Show>
        </FindIcon>
      </Button>
    </div>
  );
}

/** The panel behind the search button: the search field, then the places */
function FindPanel(props: {
  search: string;
  onSearch: (value: string) => void;
  place: PlaceFilter;
  onPlace: (value: PlaceFilter) => void;
}) {
  const { t } = useLingui();
  const places = (): {
    value: PlaceFilter;
    label: string;
    icon: IconName;
  }[] => [
    {
      value: "any",
      label: t({ message: "All", context: "event places" }),
      icon: "squares-four",
    },
    {
      value: "Voice",
      label: t({ message: "Voice", context: "event places" }),
      icon: "speaker-high",
    },
    {
      value: "Text",
      label: t({ message: "Text", context: "event places" }),
      icon: "hash",
    },
    {
      value: "External",
      label: t({ message: "Elsewhere", context: "event places" }),
      icon: "globe",
    },
  ];

  return (
    <ContextMenu
      data-persistent-context-menu
      aria-label={t`Search and filter events`}
      data-testid="events-filter"
    >
      <PanelSearch>
        <Icon name="magnifying-glass" size={16} />
        <input
          ref={(input: HTMLInputElement) => {
            // a computer types at once; a phone keeps its keyboard closed
            // until the field is tapped, so the places stay in sight
            if (!window.matchMedia?.("(max-width: 600px)").matches)
              setTimeout(() => input.focus({ preventScroll: true }), 30);
          }}
          type="search"
          value={props.search}
          placeholder={t`Search events`}
          aria-label={t`Search events`}
          onInput={(event) => props.onSearch(event.currentTarget.value)}
          data-testid="events-search"
        />
        <Show when={props.search}>
          <ClearButton
            type="button"
            aria-label={t`Clear the search`}
            onClick={() => props.onSearch("")}
            data-testid="events-search-clear"
          >
            <Icon name="x" size={14} />
          </ClearButton>
        </Show>
      </PanelSearch>
      <ContextMenuDivider />
      <PanelLabel>
        {t({ message: "Where", context: "scheduled events" })}
      </PanelLabel>
      <For each={places()}>
        {(entry) => (
          <ContextMenuButton
            role="menuitemradio"
            aria-checked={props.place === entry.value}
            icon={<Icon name={entry.icon} size={18} />}
            actionIcon={
              props.place === entry.value ? (
                <Icon name="check" size={16} />
              ) : undefined
            }
            selected={props.place === entry.value}
            onClick={() => props.onPlace(entry.value)}
            data-testid={`events-place-${entry.value}`}
          >
            {entry.label}
          </ContextMenuButton>
        )}
      </For>
    </ContextMenu>
  );
}

const FindIcon = styled("span", {
  base: { position: "relative", display: "inline-flex" },
});

const PanelSearch = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "36px",
    margin: "2px 2px 4px",
    paddingInline: "10px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-field-bg)",
    border: "1px solid var(--z-field-border)",
    color: "var(--z-fg-muted)",
    cursor: "text",
    "--z-icon-color": "currentColor",
    "&:focus-within": {
      borderColor: "var(--z-accent)",
      boxShadow: "var(--z-field-focus-shadow)",
    },
    "& input": {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      fontSize: "14px",
      fontFamily: "inherit",
    },
    "& input::-webkit-search-cancel-button": { display: "none" },
    "& input::placeholder": { color: "var(--z-fg-muted)" },
    _phone: { height: "44px", margin: "4px 4px 8px" },
  },
});

const ClearButton = styled("button", {
  base: {
    all: "unset",
    // all: unset drops the button's "relative": the phones' unseen 44 px
    // tap area (styles.css) then spread over the whole page and took every
    // tap (the calendar's last day answered taps on the tabs)
    position: "relative",
    display: "inline-grid",
    placeItems: "center",
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    cursor: "pointer",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    "&:hover": { color: "var(--z-fg-primary)" },
    "&:focus-visible": { outline: "2px solid var(--z-focus)" },
    _phone: { width: "44px", height: "44px" },
  },
});

const PanelLabel = styled("div", {
  base: {
    padding: "6px 10px 2px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 650,
    color: "var(--z-fg-muted)",
  },
});

/**
 * Words on a header button that only fit on wide desktops; the icon stays
 * (phones have the row to themselves and keep the words)
 */
const WideLabel = styled("span", {
  base: {
    "@media (min-width: 768px) and (max-width: 1499px)": { display: "none" },
  },
});

/** A search or a place is set: a dot on the search button */
const Chosen = styled("span", {
  base: {
    position: "absolute",
    top: "-2px",
    insetInlineEnd: "-3px",
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    background: "var(--z-accent)",
  },
});

/** The way to your events in every server */
function AllServersLink() {
  const navigate = useNavigate();
  return (
    <Button
      size="sm"
      variant="text"
      onPress={() => navigate("/events")}
      data-testid="events-all-servers"
    >
      <Trans>In all my servers</Trans>
    </Button>
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
    flex: "0 0 auto",
    minWidth: 0,
    "&[data-grow]": { flex: "1 1 auto" },
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

const BackLink = styled("a", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    flex: "none",
    color: "var(--z-fg-secondary)",
    fontSize: "15px",
    textDecoration: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    "&:hover": { color: "var(--z-fg-primary)" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const Grid = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
});

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Off = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    fontSize: "15px",
    lineHeight: "24px",
    "& p": { margin: 0 },
    border: "var(--z-box-border)",
  },
});

const List = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "14px" },
});

const Problem = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    padding: "16px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    fontSize: "14px",
    lineHeight: "20px",
    border: "var(--z-box-border)",
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
