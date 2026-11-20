import {
  type JSX,
  For,
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

import {
  type CalendarView,
  calendarRange,
  calendarTitle,
  dayKey,
  eventsByDay,
  moveAnchor,
  weekStartsOn,
} from "./calendarDays";
import { eventPath } from "./EventCard";
import { settled } from "./settled";

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
    async ([from, to]) =>
      (await props.load(from, to)).map((event) => event._id),
  );
  // read from the collection, so an answer or a change shows at once
  const events = createMemo(() =>
    (settled(loaded) ?? [])
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
    if (
      !calendarRange(view(), next, weekStart()).days.some(
        (day) => dayKey(day) === chosen(),
      )
    )
      setChosen(
        dayKey(
          view() === "week"
            ? next
            : new Date(next.getFullYear(), next.getMonth(), 1),
        ),
      );
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
        <h2 aria-live="polite" data-testid="calendar-title">
          <span data-long>
            {calendarTitle(view(), anchor(), weekStart(), locale())}
          </span>
          <span data-short aria-hidden="true">
            {calendarTitle(view(), anchor(), weekStart(), locale(), true)}
          </span>
        </h2>
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
              {
                value: "month",
                label: t({ message: "Month", context: "calendar" }),
              },
              {
                value: "week",
                label: t({ message: "Week", context: "calendar" }),
              },
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
                    view() === "month" &&
                    day.getMonth() !== anchor().getMonth();
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
                        aria-current={today() === key ? "date" : undefined}
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
                                data-live={
                                  event.status === "Active" || undefined
                                }
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
                                // a modified click opens a new tab, as links do
                                if (
                                  click.button !== 0 ||
                                  click.metaKey ||
                                  click.ctrlKey ||
                                  click.shiftKey ||
                                  click.altKey
                                )
                                  return;
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
                                <Show when={event.status === "Active"}>
                                  <LiveMark aria-hidden="true" />
                                </Show>
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
          <Match when={loaded.loading && !settled(loaded)}>
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
    gap: "16px",
    minWidth: 0,
  },
});

/**
 * One line: the arrows, the month, then Today and Month/Week at the end.
 * Phones keep the line with the short month name.
 */
const Bar = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    "& h2": {
      flex: "1 1 auto",
      minWidth: 0,
      margin: 0,
      fontSize: "18px",
      lineHeight: "28px",
      fontWeight: 650,
      color: "var(--z-header-primary, var(--z-fg-primary))",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& h2 [data-short]": { display: "none" },
    _phone: {
      gap: "4px",
      "& h2": { fontSize: "15px", lineHeight: "22px" },
      "& h2 [data-long]": { display: "none" },
      "& h2 [data-short]": { display: "inline" },
    },
  },
});

const Step = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    flex: "none",
    // caret-left/right already follow the reading direction (styles.css);
    // flipping them here too turned them back the wrong way in Arabic
    _phone: {
      "& button": { minWidth: "36px", minHeight: "44px", paddingInline: 0 },
    },
  },
});

const Tools = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "none",
    _phone: {
      gap: "4px",
      "& > button": { minHeight: "44px", paddingInline: "6px" },
      "& [role=radiogroup] button": { paddingInline: "8px" },
    },
  },
});

/** The month on the one box surface, quiet lines between the days */
const Grid = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    boxShadow: "var(--z-box-shadow)",
    overflow: "hidden",
    transition: "opacity 0.15s ease",
    _motionReduce: { transition: "none" },
    "&[aria-busy=true]": { opacity: 0.7 },
  },
});

const Week = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    "& + &": {
      borderBlockStart:
        "1px solid color-mix(in srgb, var(--z-fg-primary) 6%, transparent)",
    },
  },
});

const Head = styled("div", {
  base: {
    padding: "10px 10px 8px",
    textAlign: "start",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    _phone: { padding: "8px 0 6px", textAlign: "center" },
  },
});

const Cell = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    minHeight: "108px",
    padding: "6px",
    transition: "background-color 0.12s ease",
    _motionReduce: { transition: "none" },
    "& + &": {
      borderInlineStart:
        "1px solid color-mix(in srgb, var(--z-fg-primary) 6%, transparent)",
    },
    "&[data-outside] b": { color: "var(--z-fg-muted)", fontWeight: 500 },
    "&[data-outside] a": { opacity: 0.6 },
    "&[data-chosen]": {
      background: "color-mix(in srgb, var(--z-fg-primary) 4%, transparent)",
    },
    "[data-view=week] &": { minHeight: "260px" },
    _phone: {
      minHeight: "52px",
      padding: "2px",
      alignItems: "center",
      "& + &": { borderInlineStart: "none" },
      "[data-view=week] &": { minHeight: "56px" },
    },
  },
});

const DayButton = styled("button", {
  base: {
    all: "unset",
    // all: unset drops the button's "relative": the phones' unseen 44 px
    // tap area (styles.css) then spread over the whole page and took every
    // tap (the calendar's last day answered taps on the tabs)
    position: "relative",
    boxSizing: "border-box",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    alignSelf: "flex-start",
    cursor: "pointer",
    borderRadius: "999px",
    "& b": {
      display: "inline-grid",
      placeItems: "center",
      minWidth: "26px",
      height: "26px",
      paddingInline: "4px",
      borderRadius: "999px",
      fontSize: "13px",
      lineHeight: "16px",
      fontWeight: 600,
      color: "var(--z-fg-secondary)",
      fontVariantNumeric: "tabular-nums",
    },
    "&:hover b": {
      color: "var(--z-fg-primary)",
      background: "color-mix(in srgb, var(--z-fg-primary) 7%, transparent)",
    },
    // today: the accent on the date only
    "&[data-today] b, &[data-today]:hover b": {
      background: "var(--z-accent)",
      color: "var(--z-on-accent, #fff)",
      fontWeight: 700,
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    _phone: {
      alignSelf: "stretch",
      minHeight: "48px",
      justifyContent: "center",
      gap: "3px",
      "& b": { minWidth: "30px", height: "30px", fontSize: "14px" },
    },
  },
});

/** Phones: one mark for each event of the day, in place of the chips */
const Marks = styled("span", {
  base: {
    display: "none",
    gap: "3px",
    height: "5px",
    "& i": {
      width: "5px",
      height: "5px",
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
    gap: "3px",
    minWidth: 0,
    _phone: { display: "none" },
  },
});

/** An event in a day: its time, then its title, on a quiet chip */
const Chip = styled("a", {
  base: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    minWidth: 0,
    padding: "3px 6px",
    borderRadius: "var(--z-radius-sm, 6px)",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-primary)",
    textDecoration: "none",
    background: "color-mix(in srgb, var(--z-fg-primary) 7%, transparent)",
    transition: "background-color 0.12s ease",
    _motionReduce: { transition: "none" },
    "& time": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      flexShrink: 0,
      color: "var(--z-fg-muted)",
      fontVariantNumeric: "tabular-nums",
    },
    "& span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: 500,
    },
    "&[data-mine] span": { fontWeight: 650 },
    "&[data-off] span": {
      textDecoration: "line-through",
      color: "var(--z-fg-muted)",
    },
    "&:hover": {
      background: "color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "[data-view=week] &": {
      flexDirection: "column",
      alignItems: "stretch",
      gap: "2px",
      padding: "6px 8px",
      "& span": {
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        lineClamp: 3,
      },
    },
  },
});

/** A live event's chip: the live dot before its time */
const LiveMark = styled("i", {
  base: {
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: "var(--z-live)",
  },
});

const More = styled("button", {
  base: {
    all: "unset",
    // all: unset drops the button's "relative": the phones' unseen 44 px
    // tap area (styles.css) then spread over the whole page and took every
    // tap (the calendar's last day answered taps on the tabs)
    position: "relative",
    cursor: "pointer",
    paddingInline: "6px",
    fontSize: "12px",
    lineHeight: "18px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    borderRadius: "var(--z-radius-sm, 6px)",
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
      fontSize: "15px",
      lineHeight: "22px",
      fontWeight: 650,
      color: "var(--z-fg-primary)",
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
