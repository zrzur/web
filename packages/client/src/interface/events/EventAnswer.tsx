import { Match, Show, Switch, createSignal, onCleanup } from "solid-js";

import { Plural, Trans } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { isTypingTarget } from "@revolt/keybinds/shortcuts";
import { Button } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { eventKey, eventsShortcutAllowed } from "./eventFormat";

type Answer = API.ServerEventAnswer;

/** How the seats of an event stand */
export function seatState(event: API.ServerEvent) {
  const capacity = event.capacity ?? undefined;
  const going = event.counts?.going ?? 0;
  const waiting = event.counts?.waiting ?? 0;
  return {
    capacity,
    going,
    waiting,
    left: capacity === undefined ? undefined : Math.max(capacity - going, 0),
    full: capacity !== undefined && going >= capacity,
    share:
      capacity === undefined || capacity === 0
        ? 0
        : Math.min(going / capacity, 1),
  };
}

/**
 * The seats of an event as a bar; nothing for an event without a limit
 */
export function SeatBar(props: { event: API.ServerEvent }) {
  const seats = () => seatState(props.event);
  return (
    <Show when={seats().capacity !== undefined}>
      <Track
        role="img"
        data-full={seats().full || undefined}
        data-testid="event-seat-bar"
        aria-hidden="true"
      >
        <Fill style={{ width: `${Math.round(seats().share * 100)}%` }} />
      </Track>
    </Show>
  );
}

/**
 * "Will you come?": going, maybe, can't go. With a seat limit, going takes a
 * seat or a place on the waiting list. Pressing your answer again takes it
 * back.
 */
export function EventAnswer(props: {
  event: API.ServerEvent;
  serverId: string;
  /** Cards show the buttons only; the event page shows the lines too */
  compact?: boolean;
  /** Answer with G, M and X (the event's own page) */
  shortcuts?: boolean;
}) {
  const client = useClient();
  const [error, setError] = createSignal<unknown>();
  // an answer on its way: further presses wait
  const [sending, setSending] = createSignal<Answer>();

  const mine = () => client().serverEvents.answerOf(props.event._id);
  const seats = () => seatState(props.event);
  const seated = () => mine()?.answer === "Going" && !mine()?.waiting;
  const waiting = () => mine()?.answer === "Going" && !!mine()?.waiting;
  /** Going would not get a seat now */
  const noSeat = () => seats().full && !seated() && !props.event.over_capacity;
  const canWait = () => props.event.waitlist !== false;

  async function answer(next: Answer) {
    if (sending()) return;
    setSending(next);
    setError(undefined);
    try {
      if (mine()?.answer === next) {
        await client().serverEvents.withdraw(props.serverId, props.event._id);
      } else {
        await client().serverEvents.setAnswer(
          props.serverId,
          props.event._id,
          next,
        );
      }
    } catch (failure) {
      setError(failure);
    } finally {
      setSending(undefined);
    }
  }

  const onKey = (event: KeyboardEvent) => {
    if (!props.shortcuts) return;
    const key = eventKey(event);
    if (!key || key === "new") return;
    const dialogOpen = !!document.querySelector(
      "[role=dialog][aria-modal=true]",
    );
    if (!eventsShortcutAllowed(isTypingTarget(event.target), dialogOpen))
      return;
    if (key === "Going" && noSeat() && !waiting() && !canWait()) return;
    event.preventDefault();
    void answer(key);
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));
  const keys = (key: string) => (props.shortcuts ? key : undefined);

  return (
    <Box data-testid="event-answer" data-compact={props.compact || undefined}>
      <Show when={!props.compact}>
        <Question>
          <Switch fallback={<Trans>Will you come?</Trans>}>
            <Match when={waiting() && mine()?.position}>
              <Trans>
                You are number {mine()!.position} on the waiting list
              </Trans>
            </Match>
            <Match when={waiting()}>
              <Trans>You are on the waiting list</Trans>
            </Match>
            <Match when={noSeat()}>
              <Trans>All seats are taken</Trans>
            </Match>
          </Switch>
        </Question>
      </Show>
      <Choices role="group">
        <Button
          size="sm"
          variant={mine()?.answer === "Going" ? "filled" : "tonal"}
          aria-pressed={mine()?.answer === "Going"}
          isDisabled={noSeat() && !waiting() && !canWait()}
          aria-disabled={!!sending() || undefined}
          onPress={() => void answer("Going")}
          aria-keyshortcuts={keys("G")}
          data-testid="event-answer-going"
        >
          <Show when={seated()}>
            <Icon name="check" size={16} />
          </Show>
          <Switch fallback={<Trans context="event answer">Going</Trans>}>
            <Match when={waiting()}>
              <Trans>On the waiting list</Trans>
            </Match>
            <Match when={noSeat() && canWait()}>
              <Trans>Join the waiting list</Trans>
            </Match>
          </Switch>
        </Button>
        <Button
          size="sm"
          variant={mine()?.answer === "Maybe" ? "filled" : "tonal"}
          aria-pressed={mine()?.answer === "Maybe"}
          aria-disabled={!!sending() || undefined}
          onPress={() => void answer("Maybe")}
          aria-keyshortcuts={keys("M")}
          data-testid="event-answer-maybe"
        >
          <Trans context="event answer">Maybe</Trans>
        </Button>
        <Button
          size="sm"
          variant={mine()?.answer === "NotGoing" ? "filled" : "tonal"}
          aria-pressed={mine()?.answer === "NotGoing"}
          aria-disabled={!!sending() || undefined}
          onPress={() => void answer("NotGoing")}
          aria-keyshortcuts={keys("X")}
          data-testid="event-answer-not-going"
        >
          <Trans context="event answer">Can't go</Trans>
        </Button>
      </Choices>
      <Show when={!props.compact}>
        <Line data-tone={seated() ? "good" : waiting() ? "wait" : undefined}>
          <Switch>
            <Match when={seated() && seats().capacity !== undefined}>
              <Trans>You have a seat. Change your answer any time.</Trans>
            </Match>
            <Match when={waiting()}>
              <Trans>The seat becomes yours by itself when one is free.</Trans>
            </Match>
            <Match when={noSeat() && canWait()}>
              <Plural
                value={seats().waiting}
                _0="Nobody is waiting yet. Seats go to whoever came first."
                one="# person is waiting before you. Seats go to whoever came first."
                other="# people are waiting before you. Seats go to whoever came first."
              />
            </Match>
            <Match when={noSeat()}>
              <Trans>This event has no waiting list.</Trans>
            </Match>
            <Match when={seats().capacity !== undefined && !mine()}>
              <Trans>
                {seats().left ?? 0} of {seats().capacity} seats are free.
              </Trans>
            </Match>
            <Match when={mine()}>
              <Trans>Change your answer any time.</Trans>
            </Match>
          </Switch>
        </Line>
      </Show>
      <Show when={error()}>
        <Failure role="alert">
          <TranslatedError error={error()} />
        </Failure>
      </Show>
    </Box>
  );
}

const Box = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
    "&[data-compact]": { gap: "8px" },
  },
});

const Question = styled("h3", {
  base: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "24px",
    fontWeight: 650,
    color: "var(--z-header-primary, var(--z-fg-primary))",
  },
});

const Choices = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    "& > *": { minWidth: 0 },
    _phone: { gridTemplateColumns: "1fr" },
  },
});

const Line = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "&:empty": { display: "none" },
    "&[data-tone=good]": { color: "var(--z-status-success)" },
    "&[data-tone=wait]": { color: "var(--z-status-warning)" },
  },
});

const Track = styled("div", {
  base: {
    height: "6px",
    borderRadius: "999px",
    background: "var(--z-selected, var(--z-bg-input))",
    overflow: "hidden",
    "--fill": "var(--z-status-success)",
    "&[data-full]": { "--fill": "var(--z-status-warning)" },
  },
});

const Fill = styled("div", {
  base: {
    height: "100%",
    borderRadius: "999px",
    background: "var(--fill)",
  },
});

const Failure = styled("div", {
  base: {
    padding: "12px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    fontSize: "13px",
    lineHeight: "18px",
    border: "var(--z-box-border)",
  },
});
