import { JSX, Match, Show, Switch } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import {
  type API,
  type Server,
  serverEventChannel,
  serverEventLink,
} from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { Button, SettingsRow, SettingsSection } from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { seatState } from "./EventAnswer";
import { eventDay, eventPhase, eventTimes, startsIn } from "./eventFormat";
import { Stamp } from "./Ticket";

type Props = {
  event: API.ServerEvent;
  server: Server;
  now: number;
  /** Name the server on the card (a list across servers) */
  showServer?: boolean;
};

/** The address of an event's own page */
export function eventPath(serverId: string, eventId: string) {
  return `/server/${serverId}/events/${eventId}`;
}

/** Where an event takes place, in a few words */
export function EventPlace(props: { event: API.ServerEvent }) {
  const { t } = useLingui();
  const client = useClient();
  const channel = () => {
    const id = serverEventChannel(props.event.place);
    return id ? client().channels.get(id) : undefined;
  };
  return (
    <Switch>
      <Match when={props.event.place.type === "Voice"}>
        <Icon name="speaker-high" size={16} />
        <span>{channel()?.name ?? t`A voice channel`}</span>
      </Match>
      <Match when={props.event.place.type === "Text"}>
        <Icon name="hash" size={16} />
        <span>{channel()?.name ?? t`A text channel`}</span>
      </Match>
      <Match when={props.event.place.type === "External"}>
        <Icon
          name={serverEventLink(props.event.place) ? "link" : "globe"}
          size={16}
        />
        <span dir="auto">
          {(props.event.place as { location: string }).location}
        </span>
      </Match>
    </Switch>
  );
}

/** How many take part, in one short line */
export function EventCountLine(props: { event: API.ServerEvent }) {
  const seats = () => seatState(props.event);
  const going = () => seats().going;
  const maybe = () => props.event.counts?.maybe ?? 0;
  return (
    <Switch>
      <Match when={seats().capacity !== undefined && seats().full}>
        <Plural
          value={seats().waiting}
          _0="Full"
          one="Full · # waiting"
          other="Full · # waiting"
        />
      </Match>
      <Match when={seats().capacity !== undefined}>
        <Trans>
          {going()} of {seats().capacity} seats
        </Trans>
      </Match>
      <Match when={going() + maybe() === 0}>
        <Trans>Nobody answered yet</Trans>
      </Match>
      <Match when={maybe() === 0}>
        <Plural value={going()} one="# going" other="# going" />
      </Match>
      <Match when={true}>
        <Trans>
          {going()} going · {maybe()} maybe
        </Trans>
      </Match>
    </Switch>
  );
}

/** Your own answer to an event, as a short mark */
export function OwnAnswerMark(props: { event: API.ServerEvent }) {
  const client = useClient();
  const mine = () => client().serverEvents.answerOf(props.event._id);
  const limited = () => props.event.capacity != null;
  return (
    <Switch>
      <Match when={mine()?.answer === "Going" && mine()?.waiting}>
        <Stamp data-tone="wait" data-testid="event-own-answer">
          <Show
            when={mine()?.position}
            fallback={<Trans>On the waiting list</Trans>}
          >
            <Trans>Number {mine()!.position} in line</Trans>
          </Show>
        </Stamp>
      </Match>
      <Match when={mine()?.answer === "Going"}>
        <Stamp data-tone="good" data-testid="event-own-answer">
          <Icon name="check" size={16} />
          {limited() ? (
            <Trans>You have a seat</Trans>
          ) : (
            <Trans>You are going</Trans>
          )}
        </Stamp>
      </Match>
      <Match when={mine()?.answer === "Maybe"}>
        <Stamp data-testid="event-own-answer">
          <Trans context="event answer">Maybe</Trans>
        </Stamp>
      </Match>
      <Match when={mine()?.answer === "NotGoing"}>
        <Stamp data-testid="event-own-answer">
          <Trans context="event answer">Can't go</Trans>
        </Stamp>
      </Match>
    </Switch>
  );
}

/**
 * One event in a list, as a settings row (owner, 2026-11-19: every box is a
 * settings group): the day at the start, then the title, when and where,
 * how many come, and your answer at the end. Goes inside `EventGroup`.
 * The whole story is on the page of the event.
 */
export function EventCard(props: Props) {
  const { i18n } = useLingui();
  const client = useClient();
  const navigate = useNavigate();

  const phase = () => eventPhase(props.event, props.now);
  const path = () => eventPath(props.server.id, props.event._id);
  const upcoming = () =>
    props.event.status === "Scheduled" || props.event.status === "Active";
  const mine = () => client().serverEvents.answerOf(props.event._id);
  const day = () => eventDay(props.event.starts_at, i18n().locale ?? "en");

  return (
    <SettingsRow
      icon={
        <DateMark data-quiet={!upcoming() || undefined} aria-hidden="true">
          <b>{day().day}</b>
          <small>{day().month}</small>
        </DateMark>
      }
      title={
        <span data-event={props.event._id} data-phase={phase()}>
          <TitleLink
            href={path()}
            onClick={(click) => {
              click.stopPropagation();
              click.preventDefault();
              navigate(path());
            }}
            data-testid="event-open"
          >
            {props.event.title}
          </TitleLink>
        </span>
      }
      description={
        <Meta>
          <Switch>
            <Match when={props.event.status === "Draft"}>
              <State>
                <Trans context="scheduled events">Draft</Trans>
              </State>
            </Match>
            <Match when={props.event.status === "Cancelled"}>
              <State>
                <Trans context="scheduled events">Cancelled</Trans>
              </State>
            </Match>
            <Match when={props.event.status === "Completed"}>
              <State>
                <Trans>Over</Trans>
              </State>
            </Match>
            <Match when={phase() === "soon"}>
              <Soon>
                {startsIn(
                  props.event.starts_at,
                  props.now,
                  i18n().locale ?? "en",
                )}
              </Soon>
            </Match>
          </Switch>
          <MetaItem>
            <time datetime={props.event.starts_at}>
              {eventTimes(
                props.event,
                i18n().locale ?? "en",
                hour12From(timeLocale()[1].formats?.LT),
              )}
            </time>
          </MetaItem>
          <MetaItem>
            <EventPlace event={props.event} />
          </MetaItem>
          <Show when={props.showServer}>
            <MetaItem data-testid="event-server">
              <Icon name="users-three" size={16} />
              <span>{props.server.name}</span>
            </MetaItem>
          </Show>
          <Show
            when={props.event.visibility && props.event.visibility !== "Place"}
          >
            <MetaItem>
              <Icon name="lock-simple" size={16} />
              <span>
                {props.event.visibility === "Invited" ? (
                  <Trans>Invited only</Trans>
                ) : (
                  <Trans>Some roles</Trans>
                )}
              </span>
            </MetaItem>
          </Show>
          <CountLine
            data-testid="event-count-line"
            data-full={seatState(props.event).full || undefined}
          >
            <EventCountLine event={props.event} />
          </CountLine>
        </Meta>
      }
      secondary={
        <Show
          when={mine() || !upcoming()}
          fallback={
            <Button
              size="sm"
              variant="tonal"
              onPress={() => navigate(path())}
              data-testid="event-answer-open"
            >
              <Trans context="event answer">Answer</Trans>
            </Button>
          }
        >
          <OwnAnswerMark event={props.event} />
        </Show>
      }
      onClick={() => navigate(path())}
      data-testid="event-card"
    />
  );
}

/**
 * The event that is happening now, at the top of the page: a row with the
 * way in. Goes inside `EventGroup`.
 */
export function EventHero(props: Props) {
  const { t, i18n } = useLingui();
  const navigate = useNavigate();
  const path = () => eventPath(props.server.id, props.event._id);
  const started = () =>
    startsIn(
      props.event.started_at ?? props.event.starts_at,
      props.now,
      i18n().locale ?? "en",
    );

  return (
    <SettingsRow
      icon={<LiveDot aria-hidden="true" />}
      title={
        <span data-event={props.event._id}>
          <TitleLink
            href={path()}
            onClick={(click) => {
              click.stopPropagation();
              click.preventDefault();
              navigate(path());
            }}
          >
            {props.event.title}
          </TitleLink>
        </span>
      }
      description={
        <Meta>
          <Soon data-live>{t`Started ${started()}`}</Soon>
          <MetaItem>
            <EventPlace event={props.event} />
          </MetaItem>
          <CountLine>
            <EventCountLine event={props.event} />
          </CountLine>
        </Meta>
      }
      secondary={
        <JoinButton
          event={props.event}
          server={props.server}
          link={serverEventLink(props.event.place)}
        />
      }
      onClick={() => navigate(path())}
      data-testid="event-hero"
    />
  );
}

/** A titled group of event rows: the settings group (SettingsSection) */
export function EventGroup(props: {
  title?: JSX.Element;
  aside?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <SettingsSection title={props.title} aside={props.aside}>
      {props.children}
    </SettingsSection>
  );
}

/**
 * The way in while an event happens: join the voice channel, open the text
 * channel, or open the link (after the usual "leaving Zrzur" warning)
 */
export function JoinButton(props: {
  event: API.ServerEvent;
  server: Server;
  link?: string;
  size?: "sm" | "md";
}) {
  const client = useClient();
  const voice = useVoice();
  const state = useState();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const channelId = () => serverEventChannel(props.event.place);

  function go() {
    const id = channelId();
    if (id) {
      // phones: the channel slides over the channel list, as when chosen there
      state.appDrawer()?.setShown(true);
      const channel = client().channels.get(id);
      if (props.event.place.type === "Voice" && channel) {
        if (voice.channel()?.id !== id) void voice.connect(channel);
      }
      navigate(`/server/${props.server.id}/channel/${id}`);
    } else if (props.link) {
      const url = new URL(props.link);
      openModal({ type: "link_warning", url, display: url.toString() });
    }
  }

  return (
    <Show when={channelId() || props.link}>
      <Button
        size={props.size ?? "sm"}
        variant="filled"
        onPress={go}
        data-testid="event-join"
      >
        <Switch>
          <Match when={props.event.place.type === "Voice"}>
            <Icon name="speaker-high" size={16} />
            <Trans context="scheduled events">Join</Trans>
          </Match>
          <Match when={props.event.place.type === "Text"}>
            <Icon name="hash" size={16} />
            <Trans context="scheduled events">Open</Trans>
          </Match>
          <Match when={props.event.place.type === "External"}>
            <Icon name="arrow-square-out" size={16} />
            <Trans>Open link</Trans>
          </Match>
        </Switch>
      </Button>
    </Show>
  );
}

/** The day of an event in the icon column of its row */
const DateMark = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    minHeight: "40px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    "& b": {
      fontSize: "16px",
      lineHeight: "18px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& small": {
      fontSize: "11px",
      lineHeight: "14px",
      color: "var(--z-fg-secondary)",
    },
    "&[data-quiet] b": { color: "var(--z-fg-muted)" },
  },
});

/** Happening now: a dot in the live colour where the day would be */
const LiveDot = styled("span", {
  base: {
    width: "40px",
    display: "grid",
    placeItems: "center",
    "&::before": {
      content: '""',
      width: "10px",
      height: "10px",
      borderRadius: "999px",
      background: "var(--z-live)",
    },
  },
});

const TitleLink = styled("a", {
  base: {
    color: "inherit",
    textDecoration: "none",
    fontWeight: 600,
    borderRadius: "var(--z-radius-sm, 6px)",
    "&:hover": { textDecoration: "underline" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Meta = styled("span", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: "12px",
    rowGap: "2px",
    "--z-icon-color": "var(--z-fg-muted)",
  },
});

const MetaItem = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    "& > span, & > time": { minWidth: 0, overflowWrap: "anywhere" },
  },
});

const State = styled("span", {
  base: { fontWeight: 600, color: "var(--z-fg-secondary)" },
});

const Soon = styled("span", {
  base: {
    color: "var(--z-status-warning)",
    fontWeight: 600,
    "&[data-live]": { color: "var(--z-live)" },
  },
});

const CountLine = styled("span", {
  base: {
    color: "var(--z-fg-muted)",
    "&[data-full]": { color: "var(--z-status-warning)" },
  },
});
