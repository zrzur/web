import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
} from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import type { API, Server } from "@zrzur/sdk/solid";
import { serverEventLink } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { Markdown } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { Avatar, Button, TextField } from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { EventAnswer, SeatBar, seatState } from "./EventAnswer";
import { EventPlace, JoinButton, OwnAnswerMark, eventPath } from "./EventCard";
import { EventCover } from "./eventCovers";
import { eventLink, eventPhase, eventWhen, startsIn } from "./eventFormat";
import { EventStats } from "./EventStats";
import { Ticket, TicketStub } from "./Ticket";

type Attendee = API.ServerEventAttendee;
type Filter = "Going" | "Waiting" | "Maybe" | "NotGoing";

type Props = {
  event: API.ServerEvent;
  server: Server;
  now: number;
  /** After a delete: the list says what happens next for a series */
  onDeleted?: (info: { id: string; series: boolean }) => void;
};

const errorType = (failure: unknown) =>
  (failure as { type?: string } | undefined)?.type;

/**
 * The page of one event: its cover, when and where, your answer, the seats,
 * who comes, and for organisers the tools to run it.
 */
export function EventDetail(props: Props) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const [error, setError] = createSignal<unknown>();
  const [busy, setBusy] = createSignal(false);
  const [copied, setCopied] = createSignal<"yes" | "failed">();
  const [confirm, setConfirm] = createSignal<
    "cancel" | "series" | "delete" | "delete-series"
  >();

  const phase = () => eventPhase(props.event, props.now);
  const holds = () => {
    const mine = client().serverEvents.answerOf(props.event._id);
    return !!mine && mine.answer !== "NotGoing";
  };
  const seats = () => seatState(props.event);
  const repeating = () => !!props.event.repeat;
  const upcoming = () =>
    props.event.status === "Scheduled" || props.event.status === "Active";
  const draft = () => props.event.status === "Draft";
  // the people who run it: Manage Events, or named on the event
  const organiser = () =>
    client().serverEvents.isOrganiser(props.event._id) ??
    props.server.havePermission("ManageEvents");
  const mine = () => client().serverEvents.answerOf(props.event._id);
  const when = () =>
    eventWhen(
      props.event,
      i18n().locale ?? "en",
      hour12From(timeLocale()[1].formats?.LT),
    );
  const organiserNames = () =>
    [props.event.creator, ...(props.event.co_organisers ?? [])]
      .map((id) => client().users.get(id)?.displayName)
      .filter((name): name is string => !!name);
  // the people who run it may not be known here yet: ask for them once
  createEffect(
    on(
      () => [props.event.creator, ...(props.event.co_organisers ?? [])],
      (ids) => {
        for (const id of ids) {
          if (!client().users.get(id))
            void client()
              .users.fetch(id)
              .catch(() => undefined);
        }
      },
    ),
  );
  /** Whether you may read who comes (the server decides; this saves a request) */
  const namesShown = () =>
    !props.event.people_removed_at &&
    (organiser() ||
      props.event.attendee_list === "Everyone" ||
      (props.event.attendee_list === "Participants" &&
        !!mine() &&
        mine()!.answer !== "NotGoing"));

  async function act(action: () => Promise<unknown>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  function share() {
    // the app address of this Zrzur, not the page the app happens to run on
    const origin = client().configuration?.app || location.origin;
    const url = eventLink(
      origin.replace(/\/$/, ""),
      props.server.id,
      props.event._id,
    );
    const done = (state: "yes" | "failed") => {
      setCopied(state);
      setTimeout(() => setCopied(undefined), state === "yes" ? 2000 : 6000);
    };
    if (!navigator.clipboard) return done("failed");
    navigator.clipboard.writeText(url).then(
      () => done("yes"),
      () => done("failed"),
    );
  }

  return (
    <Layout
      data-testid="event-detail"
      data-event={props.event._id}
      data-phase={phase()}
    >
      <Main>
        <Show when={props.event.cover}>
          <CoverBox>
            <EventCover event={props.event} />
          </CoverBox>
        </Show>

        <Ticket
          data-live={phase() === "live" || undefined}
          data-testid="event-ticket"
        >
          <TicketStub
            startsAt={props.event.starts_at}
            liveSince={
              phase() === "live"
                ? startsIn(
                    props.event.started_at ?? props.event.starts_at,
                    props.now,
                    i18n().locale ?? "en",
                  )
                : undefined
            }
            mine={holds()}
            quiet={!upcoming()}
          />
          <TicketBody>
            <Heading>
              <Show when={!upcoming()}>
                <State>
                  <Switch>
                    <Match when={draft()}>
                      <Trans>Draft: only organisers see it</Trans>
                    </Match>
                    <Match when={props.event.status === "Cancelled"}>
                      <Trans context="scheduled events">Cancelled</Trans>
                    </Match>
                    <Match when={true}>
                      <Trans>This event is over</Trans>
                    </Match>
                  </Switch>
                </State>
              </Show>
              <h2 id={`event-${props.event._id}-title`}>{props.event.title}</h2>
            </Heading>

            <Facts>
              <Fact>
                <Icon name="calendar" size={20} />
                <time datetime={props.event.starts_at}>{when()}</time>
              </Fact>
              <Fact>
                <EventPlace event={props.event} />
              </Fact>
              <Show when={props.event.repeat}>
                <Fact>
                  <Icon name="arrows-clockwise" size={20} />
                  <span>
                    <Switch>
                      <Match when={props.event.repeat === "Daily"}>
                        <Trans>Every day</Trans>
                      </Match>
                      <Match when={props.event.repeat === "Weekly"}>
                        <Trans>Every week</Trans>
                      </Match>
                      <Match when={props.event.repeat === "EveryTwoWeeks"}>
                        <Trans>Every 2 weeks</Trans>
                      </Match>
                      <Match when={props.event.repeat === "Monthly"}>
                        <Trans>Every month</Trans>
                      </Match>
                    </Switch>
                  </span>
                </Fact>
              </Show>
              <Fact>
                <Icon
                  name={
                    props.event.visibility && props.event.visibility !== "Place"
                      ? "lock-simple"
                      : "eye"
                  }
                  size={20}
                />
                <span data-testid="event-visibility">
                  <Switch>
                    <Match when={props.event.visibility === "Invited"}>
                      <Trans>Only the invited people see it</Trans>
                    </Match>
                    <Match when={props.event.visibility === "Roles"}>
                      <Trans>Only some roles see it</Trans>
                    </Match>
                    <Match when={true}>
                      <Trans>Everyone who sees its place sees it</Trans>
                    </Match>
                  </Switch>
                </span>
              </Fact>
              <Show when={organiserNames().length}>
                <Fact>
                  <Icon name="users" size={20} />
                  <span>
                    <Trans>Organised by {organiserNames().join(", ")}</Trans>
                  </span>
                </Fact>
              </Show>
            </Facts>
            <Show when={holds()}>
              <StampRow>
                <OwnAnswerMark event={props.event} />
              </StampRow>
            </Show>
          </TicketBody>
        </Ticket>

        <Show when={props.event.description}>
          <Description>
            <Markdown content={props.event.description!} />
          </Description>
        </Show>

        <Show when={upcoming()}>
          <Panel>
            <EventAnswer
              event={props.event}
              serverId={props.server.id}
              shortcuts
            />
          </Panel>
        </Show>

        <Actions>
          <Show when={phase() === "live"}>
            <JoinButton
              event={props.event}
              server={props.server}
              link={serverEventLink(props.event.place)}
            />
          </Show>
          <Show when={!draft()}>
            <Button
              size="sm"
              variant="text"
              onPress={share}
              data-testid="event-share"
            >
              <Icon name="share-network" size={16} />
              {copied() === "yes" ? (
                <Trans>Link copied</Trans>
              ) : (
                <Trans>Copy link</Trans>
              )}
            </Button>
          </Show>
          <Show when={copied() === "failed"}>
            <Problem role="alert">
              <Trans>
                The link could not be copied. Copy it from the address bar.
              </Trans>
            </Problem>
          </Show>
        </Actions>

        <Show when={organiser()}>
          <Manage aria-label={t`Organiser tools`}>
            <Show
              when={confirm()}
              fallback={
                <>
                  <Show when={draft()}>
                    <Button
                      size="sm"
                      variant="filled"
                      isDisabled={busy()}
                      onPress={() =>
                        void act(() =>
                          client().serverEvents.publish(
                            props.server.id,
                            props.event._id,
                          ),
                        )
                      }
                      data-testid="event-publish"
                    >
                      <Trans context="scheduled events">Publish</Trans>
                    </Button>
                  </Show>
                  <Show when={upcoming() || draft()}>
                    <Button
                      size="sm"
                      variant="tonal"
                      onPress={() =>
                        openModal({
                          type: "server_event",
                          server: props.server,
                          event: props.event,
                        })
                      }
                      data-testid="event-edit"
                    >
                      <Icon name="pencil-simple" size={16} />
                      <Trans context="scheduled events">Edit</Trans>
                    </Button>
                  </Show>
                  <Show when={props.event.status === "Scheduled"}>
                    <Button
                      size="sm"
                      variant="text"
                      isDisabled={busy()}
                      onPress={() =>
                        void act(() =>
                          client().serverEvents.start(
                            props.server.id,
                            props.event._id,
                          ),
                        )
                      }
                      data-testid="event-start"
                    >
                      <Icon name="play" size={16} />
                      <Trans>Start now</Trans>
                    </Button>
                  </Show>
                  <Show when={props.event.status === "Active"}>
                    <Button
                      size="sm"
                      variant="text"
                      isDisabled={busy()}
                      onPress={() =>
                        void act(() =>
                          client().serverEvents.end(
                            props.server.id,
                            props.event._id,
                          ),
                        )
                      }
                      data-testid="event-end"
                    >
                      <Icon name="stop" size={16} />
                      <Trans context="scheduled events">End now</Trans>
                    </Button>
                  </Show>
                  <Button
                    size="sm"
                    variant="text"
                    isDisabled={busy()}
                    onPress={() =>
                      void act(async () => {
                        const copy = await client().serverEvents.copy(
                          props.server.id,
                          props.event._id,
                        );
                        navigate(eventPath(props.server.id, copy._id));
                      })
                    }
                    data-testid="event-copy"
                  >
                    <Icon name="copy" size={16} />
                    <Trans>Copy as a draft</Trans>
                  </Button>
                  <Show when={upcoming()}>
                    <Button
                      size="sm"
                      variant="text"
                      onPress={() => setConfirm("cancel")}
                      data-testid="event-cancel"
                    >
                      <Icon name="x" size={16} />
                      {repeating() ? (
                        <Trans>Cancel this time</Trans>
                      ) : (
                        <Trans>Cancel event</Trans>
                      )}
                    </Button>
                    <Show when={repeating()}>
                      <Button
                        size="sm"
                        variant="text"
                        onPress={() => setConfirm("series")}
                        data-testid="event-cancel-series"
                      >
                        <Icon name="arrows-clockwise" size={16} />
                        <Trans>Cancel the whole series</Trans>
                      </Button>
                    </Show>
                  </Show>
                  <Button
                    size="sm"
                    variant="text"
                    onPress={() => setConfirm("delete")}
                    data-testid="event-delete"
                  >
                    <Icon name="trash" size={16} />
                    {repeating() && upcoming() ? (
                      <Trans>Delete this time</Trans>
                    ) : (
                      <Trans context="scheduled events">Delete</Trans>
                    )}
                  </Button>
                  <Show when={repeating() && upcoming()}>
                    <Button
                      size="sm"
                      variant="text"
                      onPress={() => setConfirm("delete-series")}
                      data-testid="event-delete-series"
                    >
                      <Icon name="trash" size={16} />
                      <Trans>Delete the whole series</Trans>
                    </Button>
                  </Show>
                </>
              }
            >
              <Confirm role="group">
                <span>
                  <Switch>
                    <Match when={confirm() === "cancel" && repeating()}>
                      <Trans>
                        Cancel this time only? The next one stays scheduled.
                      </Trans>
                    </Match>
                    <Match when={confirm() === "cancel"}>
                      <Trans>
                        Cancel this event? The people who answered see that it
                        is off.
                      </Trans>
                    </Match>
                    <Match when={confirm() === "series"}>
                      <Trans>
                        Cancel this one and every one after it? Nothing more of
                        this series is scheduled.
                      </Trans>
                    </Match>
                    <Match when={confirm() === "delete-series"}>
                      <Trans>
                        Delete this one and every one after it for good? Nothing
                        more of this series is scheduled.
                      </Trans>
                    </Match>
                    <Match when={repeating() && upcoming()}>
                      <Trans>
                        Delete this time and its answers for good? The next one
                        stays scheduled.
                      </Trans>
                    </Match>
                    <Match when={true}>
                      <Trans>Delete this event and its answers for good?</Trans>
                    </Match>
                  </Switch>
                </span>
                <Button
                  size="sm"
                  variant="_error"
                  isDisabled={busy()}
                  onPress={() =>
                    void act(async () => {
                      const choice = confirm();
                      if (choice === "cancel" || choice === "series") {
                        await client().serverEvents.cancel(
                          props.server.id,
                          props.event._id,
                          choice === "series",
                        );
                        setConfirm(undefined);
                        return;
                      }
                      const id = props.event._id;
                      const series = choice === "delete-series";
                      await client().serverEvents.delete(
                        props.server.id,
                        id,
                        series,
                      );
                      setConfirm(undefined);
                      props.onDeleted?.({ id, series });
                      navigate(`/server/${props.server.id}/events`);
                    })
                  }
                  data-testid="event-confirm"
                >
                  <Switch
                    fallback={<Trans context="scheduled events">Delete</Trans>}
                  >
                    <Match when={confirm() === "series"}>
                      <Trans>Cancel the whole series</Trans>
                    </Match>
                    <Match when={confirm() === "cancel" && repeating()}>
                      <Trans>Cancel this time</Trans>
                    </Match>
                    <Match when={confirm() === "cancel"}>
                      <Trans>Cancel event</Trans>
                    </Match>
                    <Match when={confirm() === "delete-series"}>
                      <Trans>Delete the whole series</Trans>
                    </Match>
                    <Match when={repeating() && upcoming()}>
                      <Trans>Delete this time</Trans>
                    </Match>
                  </Switch>
                </Button>
                <Button
                  size="sm"
                  variant="text"
                  onPress={() => setConfirm(undefined)}
                >
                  <Trans context="scheduled events">Keep it</Trans>
                </Button>
              </Confirm>
            </Show>
          </Manage>
        </Show>

        <Show when={error()}>
          <Failure role="alert">
            <TranslatedError error={error()} />
          </Failure>
        </Show>
      </Main>

      <Side>
        <Show when={seats().capacity !== undefined}>
          <Panel data-testid="event-seats">
            <PanelTitle>
              <Trans context="scheduled events">Seats</Trans>
            </PanelTitle>
            <Big>
              {seats().going}{" "}
              <small>
                <Trans>of {seats().capacity}</Trans>
              </small>
            </Big>
            <SeatBar event={props.event} />
            <Note>
              <Switch>
                <Match when={props.event.over_capacity}>
                  <Trans>
                    Over its limit: an organiser seated more people than there
                    are seats.
                  </Trans>
                </Match>
                <Match when={seats().full}>
                  <Plural
                    value={seats().waiting}
                    _0="Full"
                    one="Full · # on the waiting list"
                    other="Full · # on the waiting list"
                  />
                </Match>
                <Match when={true}>
                  <Plural
                    value={seats().left ?? 0}
                    one="# seat left"
                    other="# seats left"
                  />
                </Match>
              </Switch>
            </Note>
          </Panel>
        </Show>

        <Panel data-testid="event-people">
          <PanelTitle>
            {upcoming() || draft() ? (
              <Trans>Who is coming</Trans>
            ) : (
              <Trans>Who came</Trans>
            )}
          </PanelTitle>
          <Counts>
            <span>
              <b>{props.event.counts?.going ?? 0}</b>{" "}
              <Trans context="event answer">Going</Trans>
            </span>
            <span>
              <b>{props.event.counts?.maybe ?? 0}</b>{" "}
              <Trans context="event answer">Maybe</Trans>
            </span>
            <Show when={organiser()}>
              <span>
                <b>{props.event.counts?.not_going ?? 0}</b>{" "}
                <Trans context="event answer">Can't go</Trans>
              </span>
            </Show>
          </Counts>
          <Switch>
            <Match when={props.event.people_removed_at}>
              <Note data-testid="event-people-removed">
                <Trans>
                  The names were removed 12 months after the event. The numbers
                  stay.
                </Trans>
              </Note>
            </Match>
            <Match when={!namesShown()}>
              <Note data-testid="event-people-hidden">
                <Switch>
                  <Match when={props.event.attendee_list === "Participants"}>
                    <Trans>Only the people taking part see the names.</Trans>
                  </Match>
                  <Match when={true}>
                    <Trans>Only the organisers see the names.</Trans>
                  </Match>
                </Switch>
              </Note>
            </Match>
            <Match when={true}>
              <People
                event={props.event}
                server={props.server}
                organiser={organiser()}
              />
            </Match>
          </Switch>
        </Panel>

        <Show when={organiser() && !draft()}>
          <Panel>
            <PanelTitle>
              <Trans context="scheduled events">Numbers</Trans>
            </PanelTitle>
            <EventStats event={props.event} serverId={props.server.id} />
          </Panel>
        </Show>
      </Side>
    </Layout>
  );
}

/**
 * The people of an event, by answer. Organisers can take an answer away and
 * give a waiting person a seat; seating past the limit asks first.
 */
function People(props: {
  event: API.ServerEvent;
  server: Server;
  organiser: boolean;
}) {
  const { t } = useLingui();
  const client = useClient();
  const [filter, setFilter] = createSignal<Filter>("Going");
  const [people, setPeople] = createSignal<Attendee[]>([]);
  const [next, setNext] = createSignal<string>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  // a private event: someone who manages events but is not named on it
  // writes why they need the list
  const [needsReason, setNeedsReason] = createSignal(false);
  const [reason, setReason] = createSignal("");
  const [overLimit, setOverLimit] = createSignal<Attendee>();
  const [acting, setActing] = createSignal<string>();

  const filters = (): { value: Filter; label: string; count: number }[] => {
    const counts = props.event.counts;
    const list: { value: Filter; label: string; count: number }[] = [
      {
        value: "Going",
        label: t({ message: "Going", context: "event answer" }),
        count: counts?.going ?? 0,
      },
    ];
    if ((counts?.waiting ?? 0) > 0 || filter() === "Waiting")
      list.push({
        value: "Waiting",
        label: t`Waiting`,
        count: counts?.waiting ?? 0,
      });
    list.push({
      value: "Maybe",
      label: t({ message: "Maybe", context: "event answer" }),
      count: counts?.maybe ?? 0,
    });
    if (props.organiser)
      list.push({
        value: "NotGoing",
        label: t({ message: "Can't go", context: "event answer" }),
        count: counts?.not_going ?? 0,
      });
    return list;
  };

  async function load(more = false) {
    setLoading(true);
    setError(undefined);
    try {
      const page = await client().serverEvents.fetchAttendees(
        props.server.id,
        props.event._id,
        {
          answer: filter(),
          after: more ? next() : undefined,
          limit: 25,
          reason: reason().trim() || undefined,
        },
      );
      setNeedsReason(false);
      const list = more ? [...people(), ...page.attendees] : page.attendees;
      // the waiting list reads in the order people joined it
      setPeople(
        filter() === "Waiting"
          ? [...list].sort((a, b) =>
              (a.since ?? "").localeCompare(b.since ?? ""),
            )
          : list,
      );
      setNext(page.next ?? undefined);
    } catch (failure) {
      if (errorType(failure) === "ServerEventReasonRequired") {
        setNeedsReason(true);
        setPeople([]);
      } else {
        setError(failure);
      }
    } finally {
      setLoading(false);
    }
  }

  // the list follows the tab, and the counts (someone answered meanwhile)
  createEffect(
    on(
      () =>
        [
          props.event._id,
          filter(),
          props.event.counts?.going,
          props.event.counts?.waiting,
          props.event.counts?.maybe,
          props.event.counts?.not_going,
        ] as const,
      () => void load(),
    ),
  );

  async function change(attendee: Attendee, action: () => Promise<unknown>) {
    if (acting()) return;
    setActing(attendee.user._id);
    setError(undefined);
    try {
      await action();
      setOverLimit(undefined);
      await load();
    } catch (failure) {
      if (errorType(failure) === "ServerEventOverCapacity") {
        setOverLimit(attendee);
      } else {
        setError(failure);
      }
    } finally {
      setActing(undefined);
    }
  }

  const name = (attendee: Attendee) =>
    client().users.get(attendee.user._id)?.displayName ??
    attendee.user.display_name ??
    attendee.user.username;

  return (
    <PeopleBox>
      <Tabs role="tablist" aria-label={t`Answers`}>
        <For each={filters()}>
          {(entry) => (
            <Tab
              type="button"
              role="tab"
              aria-selected={filter() === entry.value}
              onClick={() => setFilter(entry.value)}
              data-testid={`event-people-${entry.value}`}
            >
              {entry.label} <i>{entry.count}</i>
            </Tab>
          )}
        </For>
      </Tabs>

      <Show when={needsReason()}>
        <ReasonBox data-testid="event-people-reason">
          <Note>
            <Trans>
              This event is private and you are not one of its organisers. Write
              why you need its list of people; your access is noted in the audit
              log.
            </Trans>
          </Note>
          <TextField
            variant="outlined"
            label={t`Reason`}
            value={reason()}
            maxlength={200}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
          <Button
            size="sm"
            variant="tonal"
            isDisabled={!reason().trim() || loading()}
            onPress={() => void load()}
          >
            <Trans>Show the list</Trans>
          </Button>
        </ReasonBox>
      </Show>

      <Show when={overLimit()}>
        {(attendee) => (
          <ConfirmBox role="alertdialog" data-testid="event-over-capacity">
            <strong>
              <Trans>Seat {name(attendee())} past the limit?</Trans>
            </strong>
            <Note>
              <Trans>
                All {props.event.capacity} seats are taken. The event then shows
                as over its limit, and the audit log notes it under your name.
              </Trans>
            </Note>
            <Row>
              <Button
                size="sm"
                variant="filled"
                isDisabled={!!acting()}
                onPress={() =>
                  void change(attendee(), () =>
                    client().serverEvents.seatAttendee(
                      props.server.id,
                      props.event._id,
                      attendee().user._id,
                      { overCapacity: true },
                    ),
                  )
                }
                data-testid="event-over-capacity-confirm"
              >
                <Trans>Seat past the limit</Trans>
              </Button>
              <Button
                size="sm"
                variant="text"
                onPress={() => setOverLimit(undefined)}
              >
                <Trans>Cancel</Trans>
              </Button>
            </Row>
          </ConfirmBox>
        )}
      </Show>

      <Show
        when={people().length}
        fallback={
          <Show when={!loading() && !needsReason() && !error()}>
            <Note>
              <Trans>Nobody yet.</Trans>
            </Note>
          </Show>
        }
      >
        <PeopleList>
          <For each={people()}>
            {(attendee, index) => (
              <Person data-testid="event-person">
                <Show when={filter() === "Waiting"}>
                  <Order>{index() + 1}</Order>
                </Show>
                <Avatar
                  size={28}
                  src={client().users.get(attendee.user._id)?.avatarURL}
                  fallback={name(attendee)}
                />
                <span>{name(attendee)}</span>
                <Show when={props.organiser}>
                  <RowActions>
                    <Show when={filter() === "Waiting"}>
                      <Button
                        size="sm"
                        variant="tonal"
                        isDisabled={acting() === attendee.user._id}
                        onPress={() =>
                          void change(attendee, () =>
                            client().serverEvents.seatAttendee(
                              props.server.id,
                              props.event._id,
                              attendee.user._id,
                            ),
                          )
                        }
                        data-testid="event-person-seat"
                      >
                        <Trans>Give a seat</Trans>
                      </Button>
                    </Show>
                    <Button
                      size="sm"
                      variant="text"
                      isDisabled={acting() === attendee.user._id}
                      onPress={() =>
                        void change(attendee, () =>
                          client().serverEvents.removeAttendee(
                            props.server.id,
                            props.event._id,
                            attendee.user._id,
                          ),
                        )
                      }
                      data-testid="event-person-remove"
                    >
                      <Trans context="event attendee">Remove</Trans>
                    </Button>
                  </RowActions>
                </Show>
              </Person>
            )}
          </For>
        </PeopleList>
        <Show when={next()}>
          <Button
            size="sm"
            variant="text"
            isDisabled={loading()}
            onPress={() => void load(true)}
          >
            <Trans>Show more</Trans>
          </Button>
        </Show>
      </Show>

      <Show when={error()}>
        <Failure role="alert">
          <TranslatedError error={error()} />
        </Failure>
      </Show>
    </PeopleBox>
  );
}

const Layout = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: "24px",
    alignItems: "start",
    "@media (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Main = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});

const Side = styled("aside", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});

const CoverBox = styled("div", {
  base: {
    position: "relative",
    aspectRatio: "16 / 5",
    minHeight: "140px",
    overflow: "hidden",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
  },
});

const TicketBody = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "24px 28px",
    minWidth: 0,
    _phone: { padding: "16px" },
  },
});

const StampRow = styled("div", {
  base: { display: "flex", paddingBlockStart: "4px" },
});

const Heading = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& h2": {
      margin: 0,
      fontSize: "28px",
      lineHeight: "40px",
      fontWeight: 700,
      overflowWrap: "anywhere",
      color: "var(--z-header-primary, var(--z-fg-primary))",
      _phone: { fontSize: "22px", lineHeight: "32px" },
    },
  },
});

const State = styled("span", {
  base: {
    fontSize: "13px",
    fontWeight: 650,
    color: "var(--z-fg-muted)",
  },
});

const Facts = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
});

const Fact = styled("li", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-fg-secondary)",
    "& > span, & > time": { minWidth: 0, overflowWrap: "anywhere" },
  },
});

const Description = styled("div", {
  base: {
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-secondary)",
    maxWidth: "640px",
    overflowWrap: "anywhere",
  },
});

const Panel = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    minWidth: 0,
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-raised)",
  },
});

const PanelTitle = styled("h3", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 650,
    color: "var(--z-fg-muted)",
  },
});

const Big = styled("div", {
  base: {
    fontSize: "22px",
    lineHeight: "32px",
    fontWeight: 700,
    color: "var(--z-header-primary, var(--z-fg-primary))",
    "& small": {
      fontSize: "14px",
      fontWeight: 500,
      color: "var(--z-fg-secondary)",
    },
  },
});

const Counts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    columnGap: "16px",
    rowGap: "4px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "& b": {
      fontSize: "15px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
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

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    "&:empty": { display: "none" },
  },
});

const Problem = styled("span", {
  base: { fontSize: "13px", color: "var(--z-danger)" },
});

const Manage = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    paddingBlockStart: "12px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    // phones: one box of rows, as in the settings list
    _phone: {
      flexDirection: "column",
      flexWrap: "nowrap",
      alignItems: "stretch",
      gap: 0,
      padding: "4px",
      border: "none",
      borderRadius: "var(--z-radius-md, 14px)",
      background: "var(--z-bg-raised)",
      "& > button": {
        justifyContent: "flex-start",
        minHeight: "48px",
        width: "100%",
      },
    },
  },
});

const Confirm = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    "& > span": { flexBasis: "100%" },
  },
});

const PeopleBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
});

const Tabs = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "4px" },
});

const Tab = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "28px",
    paddingInline: "10px",
    border: "none",
    borderRadius: "999px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    "& i": {
      fontStyle: "normal",
      fontSize: "12px",
      color: "var(--z-fg-muted)",
    },
    "&:hover": { background: "var(--z-hover)" },
    "&[aria-selected=true]": {
      background: "var(--z-selected)",
      color: "var(--z-fg-primary)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const PeopleList = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "10px" },
});

const Person = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    fontSize: "14px",
    fontWeight: 500,
    minWidth: 0,
    // the name keeps room for itself: the actions drop to their own line
    // only when both do not fit beside it
    "& > span": {
      flex: "1 1 96px",
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Order = styled("i", {
  base: {
    fontStyle: "normal",
    minWidth: "16px",
    textAlign: "center",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const RowActions = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    marginInlineStart: "auto",
    justifyContent: "flex-end",
  },
});

const Row = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const ReasonBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    "& > :nth-child(2)": { alignSelf: "stretch" },
  },
});

const ConfirmBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "color-mix(in srgb, var(--z-status-warning) 12%, transparent)",
    fontSize: "14px",
    lineHeight: "20px",
  },
});

const Failure = styled("div", {
  base: {
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
    fontSize: "13px",
    lineHeight: "18px",
  },
});
