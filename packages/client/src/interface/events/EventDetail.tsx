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
import { serverEventChannel, serverEventLink } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { Markdown } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import {
  Avatar,
  Button,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
  TextField,
  Toggle,
} from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { EventAnswer, SeatBar, seatState } from "./EventAnswer";
import { JoinButton, eventPath } from "./EventCard";
import { EventCover } from "./eventCovers";
import { eventLink, eventPhase, eventWhen, startsIn } from "./eventFormat";
import { eventIcs, icsFileName, linkBase, shareLink } from "./eventLinks";
import { EventShare } from "./EventShare";
import { EventStats } from "./EventStats";

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
 * who comes, and for organisers the tools to run it. Every box is a settings
 * group (owner, 2026-11-19: the same group, rows and headings as Settings).
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

  /** Where it takes place: the channel's name, or the place written down */
  const placeName = () => {
    const channel = serverEventChannel(props.event.place);
    if (channel) {
      const name = client().channels.get(channel)?.name;
      if (name) return name;
      return props.event.place.type === "Text"
        ? t`A text channel`
        : t`A voice channel`;
    }
    return (props.event.place as { location?: string }).location ?? "";
  };
  const placeIcon = () =>
    props.event.place.type === "Voice"
      ? "speaker-high"
      : props.event.place.type === "Text"
        ? "hash"
        : serverEventLink(props.event.place)
          ? "link"
          : "globe";

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

  /** The link that opens this event: its share link when it has one */
  function linkOfEvent() {
    // the app address of this Zrzur, not the page the app happens to run on
    const origin = client().configuration?.app || location.origin;
    return props.event.link
      ? shareLink(linkBase(origin), props.event.link)
      : eventLink(origin.replace(/\/$/, ""), props.server.id, props.event._id);
  }

  /** Save the event as a calendar file, for the calendar of the device */
  function addToCalendar() {
    const file = new Blob([eventIcs(props.event, placeName(), linkOfEvent())], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = icsFileName(props.event.title);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function share() {
    const url = linkOfEvent();
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

  const edit = () =>
    openModal({
      type: "server_event",
      server: props.server,
      event: props.event,
    });

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

        <Heading>
          <Show when={!upcoming() || phase() === "live"}>
            <State data-live={phase() === "live" || undefined}>
              <Switch>
                <Match when={phase() === "live"}>
                  <Trans>Happening now</Trans>
                </Match>
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
          <Show when={phase() === "live"}>
            <div>
              <JoinButton
                event={props.event}
                server={props.server}
                link={serverEventLink(props.event.place)}
              />
            </div>
          </Show>
        </Heading>

        <div data-testid="event-ticket">
          <SettingsSection>
            <SettingsRow
              icon={<Icon name="calendar" size={20} />}
              title={<time datetime={props.event.starts_at}>{when()}</time>}
              description={
                phase() === "live"
                  ? t`Started ${startsIn(
                      props.event.started_at ?? props.event.starts_at,
                      props.now,
                      i18n().locale ?? "en",
                    )}`
                  : upcoming()
                    ? startsIn(
                        props.event.starts_at,
                        props.now,
                        i18n().locale ?? "en",
                      )
                    : undefined
              }
            />
            <SettingsRow
              icon={<Icon name={placeIcon()} size={20} />}
              title={<span dir="auto">{placeName()}</span>}
              description={
                <Switch>
                  <Match when={props.event.place.type === "Voice"}>
                    <Trans>Voice channel</Trans>
                  </Match>
                  <Match when={props.event.place.type === "Text"}>
                    <Trans>Text channel</Trans>
                  </Match>
                  <Match when={true}>
                    <Trans>Outside the server</Trans>
                  </Match>
                </Switch>
              }
            />
            <Show when={props.event.repeat}>
              <SettingsRow
                icon={<Icon name="arrows-clockwise" size={20} />}
                title={
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
                }
              />
            </Show>
            <SettingsRow
              icon={
                <Icon
                  name={
                    props.event.visibility && props.event.visibility !== "Place"
                      ? "lock-simple"
                      : "eye"
                  }
                  size={20}
                />
              }
              title={
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
              }
            />
            <Show when={organiserNames().length}>
              <SettingsRow
                icon={<Icon name="users" size={20} />}
                title={organiserNames().join(", ")}
                description={<Trans>Organisers</Trans>}
              />
            </Show>
          </SettingsSection>
        </div>

        <Show when={props.event.description}>
          <SettingsSection title={<Trans>About this event</Trans>}>
            <SettingsFormPanel>
              <Description>
                <Markdown content={props.event.description!} />
              </Description>
            </SettingsFormPanel>
          </SettingsSection>
        </Show>

        <Show when={upcoming()}>
          <SettingsSection title={<Trans>Your answer</Trans>}>
            <SettingsFormPanel>
              <EventAnswer
                event={props.event}
                serverId={props.server.id}
                shortcuts
              />
            </SettingsFormPanel>
          </SettingsSection>
        </Show>

        <Show when={!draft()}>
          <SettingsSection title={<Trans>For you</Trans>}>
            <SettingsRow
              icon={<Icon name="share-network" size={20} />}
              title={
                copied() === "yes" ? (
                  <Trans>Link copied</Trans>
                ) : (
                  <Trans>Copy link</Trans>
                )
              }
              description={
                copied() === "failed" ? (
                  <Problem role="alert">
                    <Trans>
                      The link could not be copied. Copy it from the address
                      bar.
                    </Trans>
                  </Problem>
                ) : undefined
              }
              navigational
              onClick={share}
            />
            <Show when={upcoming()}>
              <SettingsRow
                icon={<Icon name="calendar" size={20} />}
                title={<Trans>Add to my calendar</Trans>}
                description={
                  <Trans>Saves a file your calendar app opens.</Trans>
                }
                navigational
                onClick={addToCalendar}
              />
            </Show>
            <Show when={upcoming() && holds()}>
              <SettingsRow
                icon={
                  <Icon
                    name={mine()?.muted ? "bell-slash" : "bell"}
                    size={20}
                  />
                }
                title={<Trans>Reminders for this event</Trans>}
                description={
                  <Trans>The organisers choose when they come.</Trans>
                }
                control={(ids) => (
                  <Toggle
                    checked={mine()?.muted !== true}
                    disabled={busy()}
                    onChange={(on: boolean) =>
                      void act(() =>
                        client().serverEvents.setMuted(
                          props.server.id,
                          props.event._id,
                          !on,
                        ),
                      )
                    }
                    aria-labelledby={ids.labelId}
                    aria-describedby={ids.descriptionId}
                    data-testid="event-mute"
                  />
                )}
              />
            </Show>
          </SettingsSection>
        </Show>

        <Show when={organiser()}>
          <SettingsSection title={<Trans>Organiser tools</Trans>}>
            <div data-testid="event-manage" style={{ display: "contents" }}>
              <Show when={draft()}>
                <SettingsRow
                  icon={<Icon name="paper-plane-tilt" size={20} />}
                  title={<Trans context="scheduled events">Publish</Trans>}
                  description={
                    <Trans>Members who may see it get it in their list.</Trans>
                  }
                  disabled={busy()}
                  navigational
                  onClick={() =>
                    void act(() =>
                      client().serverEvents.publish(
                        props.server.id,
                        props.event._id,
                      ),
                    )
                  }
                  data-testid="event-publish"
                />
              </Show>
              <Show when={upcoming() || draft()}>
                <SettingsRow
                  icon={<Icon name="pencil-simple" size={20} />}
                  title={<Trans context="scheduled events">Edit</Trans>}
                  description={
                    <Trans>Title, time, place, seats and who sees it.</Trans>
                  }
                  navigational
                  onClick={edit}
                  data-testid="event-edit"
                />
              </Show>
              <Show when={props.event.status === "Scheduled"}>
                <SettingsRow
                  icon={<Icon name="play" size={20} />}
                  title={<Trans>Start now</Trans>}
                  description={
                    <Trans>Starts it before its time; people are told.</Trans>
                  }
                  disabled={busy()}
                  navigational
                  onClick={() =>
                    void act(() =>
                      client().serverEvents.start(
                        props.server.id,
                        props.event._id,
                      ),
                    )
                  }
                  data-testid="event-start"
                />
              </Show>
              <Show when={props.event.status === "Active"}>
                <SettingsRow
                  icon={<Icon name="stop" size={20} />}
                  title={<Trans context="scheduled events">End now</Trans>}
                  disabled={busy()}
                  navigational
                  onClick={() =>
                    void act(() =>
                      client().serverEvents.end(
                        props.server.id,
                        props.event._id,
                      ),
                    )
                  }
                  data-testid="event-end"
                />
              </Show>
              <SettingsRow
                icon={<Icon name="copy" size={20} />}
                title={<Trans>Copy as a draft</Trans>}
                description={
                  <Trans>A new draft with the same details, to change.</Trans>
                }
                disabled={busy()}
                navigational
                onClick={() =>
                  void act(async () => {
                    const copy = await client().serverEvents.copy(
                      props.server.id,
                      props.event._id,
                    );
                    navigate(eventPath(props.server.id, copy._id));
                  })
                }
                data-testid="event-copy"
              />
            </div>
          </SettingsSection>

          <SettingsSection title={<Trans>Cancel or delete</Trans>}>
            <Show when={upcoming()}>
              <SettingsRow
                icon={<Icon name="x-circle" size={20} />}
                title={
                  repeating() ? (
                    <Trans>Cancel this time</Trans>
                  ) : (
                    <Trans>Cancel event</Trans>
                  )
                }
                description={
                  repeating() ? (
                    <Trans>The next one stays scheduled.</Trans>
                  ) : (
                    <Trans>It stays in the list, marked as cancelled.</Trans>
                  )
                }
                danger
                navigational
                onClick={() => setConfirm("cancel")}
                data-testid="event-cancel"
              />
              <Show when={repeating()}>
                <SettingsRow
                  icon={<Icon name="arrows-clockwise" size={20} />}
                  title={<Trans>Cancel the whole series</Trans>}
                  danger
                  navigational
                  onClick={() => setConfirm("series")}
                  data-testid="event-cancel-series"
                />
              </Show>
            </Show>
            <SettingsRow
              icon={<Icon name="trash" size={20} />}
              title={
                repeating() && upcoming() ? (
                  <Trans>Delete this time</Trans>
                ) : (
                  <Trans context="scheduled events">Delete</Trans>
                )
              }
              description={<Trans>Gone for good, with its answers.</Trans>}
              danger
              navigational
              onClick={() => setConfirm("delete")}
              data-testid="event-delete"
            />
            <Show when={repeating() && upcoming()}>
              <SettingsRow
                icon={<Icon name="trash" size={20} />}
                title={<Trans>Delete the whole series</Trans>}
                danger
                navigational
                onClick={() => setConfirm("delete-series")}
                data-testid="event-delete-series"
              />
            </Show>
            <Show when={confirm()}>
              <SettingsFormPanel>
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
                          Cancel this one and every one after it? Nothing more
                          of this series is scheduled.
                        </Trans>
                      </Match>
                      <Match when={confirm() === "delete-series"}>
                        <Trans>
                          Delete this one and every one after it for good?
                          Nothing more of this series is scheduled.
                        </Trans>
                      </Match>
                      <Match when={repeating() && upcoming()}>
                        <Trans>
                          Delete this time and its answers for good? The next
                          one stays scheduled.
                        </Trans>
                      </Match>
                      <Match when={true}>
                        <Trans>
                          Delete this event and its answers for good?
                        </Trans>
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
                      fallback={
                        <Trans context="scheduled events">Delete</Trans>
                      }
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
              </SettingsFormPanel>
            </Show>
          </SettingsSection>
        </Show>

        <Show when={organiser() && (upcoming() || draft())}>
          <EventShare event={props.event} serverId={props.server.id} />
        </Show>

        <Show when={error()}>
          <Failure role="alert">
            <TranslatedError error={error()} />
          </Failure>
        </Show>
      </Main>

      <Side>
        <Show when={seats().capacity !== undefined}>
          <div data-testid="event-seats">
            <SettingsSection
              title={<Trans context="scheduled events">Seats</Trans>}
            >
              <SettingsFormPanel>
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
                        Over its limit: an organiser seated more people than
                        there are seats.
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
              </SettingsFormPanel>
            </SettingsSection>
          </div>
        </Show>

        <div data-testid="event-people">
          <SettingsSection
            title={
              upcoming() || draft() ? (
                <Trans>Who is coming</Trans>
              ) : (
                <Trans>Who came</Trans>
              )
            }
          >
            <Switch>
              <Match when={props.event.people_removed_at}>
                <SettingsFormPanel>
                  <Note data-testid="event-people-removed">
                    <Trans>
                      The names were removed 12 months after the event. The
                      numbers stay.
                    </Trans>
                  </Note>
                </SettingsFormPanel>
              </Match>
              <Match when={!namesShown()}>
                <SettingsFormPanel>
                  <Note data-testid="event-people-hidden">
                    <Switch>
                      <Match
                        when={props.event.attendee_list === "Participants"}
                      >
                        <Trans>
                          Only the people taking part see the names.
                        </Trans>
                      </Match>
                      <Match when={true}>
                        <Trans>Only the organisers see the names.</Trans>
                      </Match>
                    </Switch>
                  </Note>
                </SettingsFormPanel>
              </Match>
              <Match when={true}>
                <People
                  event={props.event}
                  server={props.server}
                  organiser={organiser()}
                />
              </Match>
            </Switch>
          </SettingsSection>
        </div>

        <Show when={organiser() && !draft()}>
          <SettingsSection
            title={<Trans context="scheduled events">Numbers</Trans>}
          >
            <EventStats event={props.event} serverId={props.server.id} />
          </SettingsSection>
        </Show>
      </Side>
    </Layout>
  );
}

/**
 * The people of an event, by answer, as rows of the "Who is coming" group.
 * The answers are buttons with their counts above the rows. Organisers can
 * take an answer away and give a waiting person a seat; seating past the
 * limit asks first.
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

  // the list follows the chosen answer, and the counts (someone answered meanwhile)
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
    <>
      <SettingsFormPanel>
        <Answers role="tablist" aria-label={t`Answers`}>
          <For each={filters()}>
            {(entry) => (
              <Button
                size="sm"
                variant={filter() === entry.value ? "filled" : "tonal"}
                role="tab"
                aria-selected={filter() === entry.value}
                onPress={() => setFilter(entry.value)}
                data-testid={`event-people-${entry.value}`}
              >
                {entry.label} ({entry.count})
              </Button>
            )}
          </For>
        </Answers>

        <Show when={needsReason()}>
          <ReasonBox data-testid="event-people-reason">
            <Note>
              <Trans>
                This event is private and you are not one of its organisers.
                Write why you need its list of people; your access is noted in
                the audit log.
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
                  All {props.event.capacity} seats are taken. The event then
                  shows as over its limit, and the audit log notes it under your
                  name.
                </Trans>
              </Note>
              <ButtonRow>
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
              </ButtonRow>
            </ConfirmBox>
          )}
        </Show>

        <Show
          when={!people().length && !loading() && !needsReason() && !error()}
        >
          <Note>
            <Trans>Nobody yet.</Trans>
          </Note>
        </Show>
      </SettingsFormPanel>

      <For each={people()}>
        {(attendee, index) => (
          <SettingsRow
            icon={
              <Avatar
                size={28}
                src={client().users.get(attendee.user._id)?.avatarURL}
                fallback={name(attendee)}
              />
            }
            title={name(attendee)}
            description={
              filter() === "Waiting" ? (
                <Trans>Number {index() + 1} in line</Trans>
              ) : undefined
            }
            control={
              props.organiser
                ? () => (
                    <RowActions>
                      <Show when={filter() === "Waiting"}>
                        <Button
                          size="sm"
                          variant="tonal"
                          aria-label={t`Give ${name(attendee)} a seat`}
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
                          <Icon name="check" size={16} />
                        </Button>
                      </Show>
                      <Button
                        size="sm"
                        variant="text"
                        aria-label={t`Remove ${name(attendee)}`}
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
                        <Icon name="x" size={16} />
                      </Button>
                    </RowActions>
                  )
                : undefined
            }
            data-testid="event-person"
          />
        )}
      </For>
      <Show when={next()}>
        <SettingsRow
          icon={<Icon name="caret-down" size={20} />}
          title={<Trans>Show more</Trans>}
          disabled={loading()}
          navigational
          onClick={() => void load(true)}
        />
      </Show>

      <Show when={error()}>
        <SettingsFormPanel>
          <Failure role="alert">
            <TranslatedError error={error()} />
          </Failure>
        </SettingsFormPanel>
      </Show>
    </>
  );
}

const Layout = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: "24px",
    alignItems: "start",
    "@media (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Main = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
  },
});

const Side = styled("aside", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
  },
});

const CoverBox = styled("div", {
  base: {
    position: "relative",
    aspectRatio: "16 / 5",
    minHeight: "140px",
    overflow: "hidden",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    background: "var(--z-bg-input)",
  },
});

const Heading = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    "& h2": {
      margin: 0,
      fontSize: "22px",
      lineHeight: "32px",
      fontWeight: 700,
      overflowWrap: "anywhere",
      color: "var(--z-header-primary, var(--z-fg-primary))",
    },
  },
});

const State = styled("span", {
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    "&[data-live]": { color: "var(--z-live)" },
  },
});

const Description = styled("div", {
  base: {
    fontSize: "14px",
    lineHeight: "22px",
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
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

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Problem = styled("span", {
  base: { color: "var(--z-danger)" },
});

const Confirm = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    lineHeight: "20px",
    "& > span": { flexBasis: "100%" },
  },
});

const Answers = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const RowActions = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    justifyContent: "flex-end",
  },
});

const ButtonRow = styled("div", {
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
