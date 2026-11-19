import {
  For,
  type JSX,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { useNavigate } from "@revolt/routing";
import { Button, Segmented } from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { eventPath } from "./EventCard";
import {
  type CalendarView,
  calendarRange,
  calendarTitle,
  dayKey,
  eventsByDay,
  moveAnchor,
  weekStartsOn,
} from "./calendarDays";

type Event = API.ServerEvent;

/** Events a day cell lists before "more" */
const CELL_EVENTS = 3;

/**
 * Events on a month or a week. A day lists its events by start time; a
 * click on a day shows that day's tickets underneath (`day` renders them).
 * Phones get the same days as a compact grid of numbers with a mark for
 * each event, and the chosen day's tickets below.
 */
export function EventCalendar(props: {
  /** Loads the events that start in a span of time */
  load: (from: string, to: string) => Promise<Event[]>;
  /** The tickets of one day, under the grid */
  day: (events: Event[]) => JSX.Element;
  /** Leave events out (search, place) */
  filter?: (event: Event) => boolean;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const locale = () => i18n().locale ?? "en";
  const weekStart = () => weekStartsOn(locale());
  const today = () => dayKey(new Date());

  const [view, setView] = createSignal<CalendarView>("month");
  const [anchor, setAnchor] = createSignal(new Date());
  const [chosen, setChosen] = createSignal(today());

  const range = createMemo(() => calendarRange(view(), anchor(), weekStart()));
  const [loaded, { refetch }] = createResource(
    () => [range().from.toISOString(), range().to.toISOString()] as const,
    async ([from, to]) => (await props.load(from, to)).map((event) => event._id),
  );
  // read from the collection, so an answer or a change shows at once
  const events = createMemo(() =>
    (loaded.latest ?? [])
      .map((id) => client().serverEvents.get(id))
      .filter(
        (event): event is Event =>
          !!event &&
          event.status !== "Draft" &&
          (props.filter?.(event) ?? true),
      ),
  );
  const byDay = createMemo(() => eventsByDay(events()));
  const weeks = createMemo(() => {
    const days = range().days;
    return Array.from({ length: days.length / 7 }, (_, index) =>
      days.slice(index * 7, index * 7 + 7),
    );
  });
  const chosenEvents = () => byDay().get(chosen()) ?? [];

  const time = (event: Event) =>
    new Intl.DateTimeFormat(locale(), {
      numberingSystem: "latn",
      hour: "numeric",
      minute: "2-digit",
      hour12: hour12From(timeLocale()[1].formats?.LT),
    }).format(new Date(event.starts_at));
  const weekday = (date: Date, long = false) =>
    new Intl.DateTimeFormat(locale(), {
      weekday: long ? "long" : "short",
    }).format(date);
  const longDay = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(locale(), {
      numberingSystem: "latn",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(year, month - 1, day));
  };
  const mine = (event: Event) => {
    const answer = client().serverEvents.answerOf(event._id);
    return !!answer && answer.answer !== "NotGoing";
  };

  function move(step: -1 | 1) {
    const next = moveAnchor(view(), anchor(), step);
    setAnchor(next);
    // the chosen day follows into the new span
    if (!calendarRange(view(), next, weekStart()).days.some(
      (day) => dayKey(day) === chosen(),
    ))
      setChosen(dayKey(view() === "week" ? next : new Date(next.getFullYear(), next.getMonth(), 1)));
  }

  function goToday() {
    setAnchor(new Date());
    setChosen(today());
  }

  return (
    <Box data-testid="event-calendar" data-view={view()}>
      <Bar>
        <Step>
          <Button
            size="sm"
            variant="text"
            aria-label={view() === "month" ? t`Month before` : t`Week before`}
            onPress={() => move(-1)}
            data-testid="calendar-previous"
          >
            <Icon name="caret-left" size={16} />
          </Button>
          <h2 aria-live="polite" data-testid="calendar-title">
            {calendarTitle(view(), anchor(), weekStart(), locale())}
          </h2>
          <Button
            size="sm"
            variant="text"
            aria-label={view() === "month" ? t`Month after` : t`Week after`}
            onPress={() => move(1)}
            data-testid="calendar-next"
          >
            <Icon name="caret-right" size={16} />
          </Button>
        </Step>
        <Tools>
          <Button
            size="sm"
            variant="text"
            onPress={goToday}
            data-testid="calendar-today"
          >
            <Trans context="calendar">Today</Trans>
          </Button>
          <Segmented<CalendarView>
            aria-label={t`How much to show`}
            value={view()}
            onChange={setView}
            options={[
              { value: "month", label: t({ message: "Month", context: "calendar" }) },
              { value: "week", label: t({ message: "Week", context: "calendar" }) },
            ]}
          />
        </Tools>
      </Bar>

      <Show when={loaded.error}>
        <Problem role="alert">
          <TranslatedError error={loaded.error} />
          <Button size="sm" variant="tonal" onPress={() => void refetch()}>
            <Trans>Try again</Trans>
          </Button>
        </Problem>
      </Show>

      <Grid
        role="grid"
        aria-label={calendarTitle(view(), anchor(), weekStart(), locale())}
        aria-busy={loaded.loading}
      >
        <Week role="row" data-head>
          <For each={weeks()[0]}>
            {(day) => (
              <Head role="columnheader" aria-label={weekday(day, true)}>
                {weekday(day)}
              </Head>
            )}
          </For>
        </Week>
        <For each={weeks()}>
          {(week) => (
            <Week role="row">
              <For each={week}>
                {(day) => {
                  const key = dayKey(day);
                  const list = () => byDay().get(key) ?? [];
                  const outside = () =>
                    view() === "month" && day.getMonth() !== anchor().getMonth();
                  return (
                    <Cell
                      role="gridcell"
                      data-day={key}
                      data-outside={outside() || undefined}
                      data-chosen={chosen() === key || undefined}
                      aria-selected={chosen() === key}
                    >
                      <DayButton
                        type="button"
                        data-today={today() === key || undefined}
                        aria-label={
                          list().length
                            ? t`${longDay(key)}, ${list().length} events`
                            : longDay(key)
                        }
                        aria-pressed={chosen() === key}
                        onClick={() => setChosen(key)}
                        data-testid="calendar-day"
                      >
                        <b>{day.getDate()}</b>
                        <Marks aria-hidden="true">
                          <For each={list().slice(0, CELL_EVENTS)}>
                            {(event) => (
                              <i
                                data-live={event.status === "Active" || undefined}
                                data-mine={mine(event) || undefined}
                              />
                            )}
                          </For>
                        </Marks>
                      </DayButton>
                      <Chips>
                        <For
                          each={
                            view() === "week"
                              ? list()
                              : list().slice(0, CELL_EVENTS)
                          }
                        >
                          {(event) => (
                            <Chip
                              href={eventPath(event.server, event._id)}
                              onClick={(click) => {
                                click.preventDefault();
                                navigate(eventPath(event.server, event._id));
                              }}
                              data-live={event.status === "Active" || undefined}
                              data-mine={mine(event) || undefined}
                              data-off={
                                event.status === "Cancelled" || undefined
                              }
                              data-testid="calendar-event"
                            >
                              <time datetime={event.starts_at}>
                                {time(event)}
                              </time>
                              <span dir="auto">{event.title}</span>
                            </Chip>
                          )}
                        </For>
                        <Show
                          when={
                            view() === "month" && list().length > CELL_EVENTS
                          }
                        >
                          <More type="button" onClick={() => setChosen(key)}>
                            <Trans>{list().length - CELL_EVENTS} more</Trans>
                          </More>
                        </Show>
                      </Chips>
                    </Cell>
                  );
                }}
              </For>
            </Week>
          )}
        </For>
      </Grid>

      <DaySection data-testid="calendar-day-list">
        <h3>{longDay(chosen())}</h3>
        <Switch>
          <Match when={chosenEvents().length}>
            {props.day(chosenEvents())}
          </Match>
          <Match when={loaded.loading && !loaded.latest}>
            <Quiet aria-busy="true">
              <Trans>Loading events</Trans>
            </Quiet>
          </Match>
          <Match when={true}>
            <Quiet>
              <Trans>Nothing on this day.</Trans>
            </Quiet>
          </Match>
        </Switch>
      </DaySection>
    </Box>
  );
}

const Box = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    minWidth: 0,
  },
});

const Bar = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
});

const Step = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    "& h2": {
      margin: 0,
      minWidth: "9em",
      textAlign: "center",
      fontSize: "18px",
      lineHeight: "28px",
      fontWeight: 700,
      color: "var(--z-header-primary, var(--z-fg-primary))",
    },
    // caret-left/right already follow the reading direction (styles.css);
    // flipping them here too turned them back the wrong way in Arabic
    _phone: {
      flex: 1,
      justifyContent: "space-between",
      "& h2": { minWidth: 0, fontSize: "16px" },
      "& button": { minWidth: "44px", minHeight: "44px" },
    },
  },
});

const Tools = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    _phone: { width: "100%", justifyContent: "space-between" },
  },
});

const Grid = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-raised)",
    overflow: "hidden",
    "&[aria-busy=true]": { opacity: 0.7 },
  },
});

const Week = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    "& + &": { borderBlockStart: "1px solid var(--z-border-subtle)" },
  },
});

const Head = styled("div", {
  base: {
    padding: "8px 4px",
    textAlign: "center",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 650,
    color: "var(--z-fg-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Cell = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    minHeight: "104px",
    padding: "6px",
    "& + &": { borderInlineStart: "1px solid var(--z-border-subtle)" },
    "&[data-outside]": { opacity: 0.45 },
    "&[data-chosen]": {
      background: "color-mix(in srgb, var(--z-fg-primary) 5%, transparent)",
    },
    "[data-view=week] &": { minHeight: "220px" },
    _phone: {
      minHeight: "52px",
      padding: "2px",
      alignItems: "center",
      "[data-view=week] &": { minHeight: "52px" },
    },
  },
});

const DayButton = styled("button", {
  base: {
    all: "unset",
    boxSizing: "border-box",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    alignSelf: "flex-start",
    cursor: "pointer",
    borderRadius: "var(--z-radius-sm, 6px)",
    "& b": {
      display: "inline-grid",
      placeItems: "center",
      minWidth: "28px",
      height: "28px",
      paddingInline: "4px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--z-fg-secondary)",
    },
    "&[data-today] b": {
      background: "var(--z-nav-selected)",
      color: "var(--z-fg-primary)",
      fontWeight: 700,
    },
    "&:hover b": { color: "var(--z-fg-primary)" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    _phone: {
      alignSelf: "stretch",
      minHeight: "48px",
      justifyContent: "center",
      gap: "2px",
    },
  },
});

/** Phones: one mark for each event of the day, in place of the chips */
const Marks = styled("span", {
  base: {
    display: "none",
    gap: "3px",
    height: "6px",
    "& i": {
      width: "6px",
      height: "6px",
      borderRadius: "999px",
      background: "var(--z-fg-muted)",
    },
    "& i[data-mine]": { background: "var(--z-fg-primary)" },
    "& i[data-live]": { background: "var(--z-live)" },
    _phone: { display: "flex" },
  },
});

const Chips = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    _phone: { display: "none" },
  },
});

const Chip = styled("a", {
  base: {
    display: "flex",
    gap: "6px",
    minWidth: 0,
    padding: "2px 6px",
    borderRadius: "var(--z-radius-sm, 6px)",
    fontSize: "12px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
    textDecoration: "none",
    background: "color-mix(in srgb, var(--z-fg-primary) 6%, transparent)",
    "& time": { flexShrink: 0, color: "var(--z-fg-muted)" },
    "& span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "&[data-mine]": { color: "var(--z-fg-primary)", fontWeight: 600 },
    "&[data-live]": {
      background: "color-mix(in srgb, var(--z-live) 16%, transparent)",
      color: "var(--z-fg-primary)",
    },
    "&[data-off] span": { textDecoration: "line-through" },
    "&:hover": {
      background: "color-mix(in srgb, var(--z-fg-primary) 11%, transparent)",
      color: "var(--z-fg-primary)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "[data-view=week] &": {
      flexDirection: "column",
      gap: 0,
      padding: "6px 8px",
      "& span": { whiteSpace: "normal", overflowWrap: "anywhere" },
    },
  },
});

const More = styled("button", {
  base: {
    all: "unset",
    cursor: "pointer",
    paddingInline: "6px",
    fontSize: "12px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
    "&:hover": { color: "var(--z-fg-primary)" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
  },
});

const DaySection = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    "& h3": {
      margin: 0,
      fontSize: "13px",
      lineHeight: "20px",
      fontWeight: 650,
      color: "var(--z-fg-muted)",
    },
  },
});

const Quiet = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Problem = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "var(--z-danger)",
  },
});
