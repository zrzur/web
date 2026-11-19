import { For, Match, Show, Switch, createResource } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Button } from "@revolt/ui";

/** A day of the numbers as "12 Nov" */
function dayLabel(day: string, locale: string) {
  return new Intl.DateTimeFormat(locale || "en", {
    numberingSystem: "latn",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * Organisers: the numbers of an event. How many answered and how, how full
 * it is, on which days people signed up, and how many were in the voice
 * channel when it started. Numbers only: no names.
 */
export function EventStats(props: {
  event: API.ServerEvent;
  serverId: string;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  // asked again when an answer changes the counts
  const [stats, { refetch }] = createResource(
    () =>
      [
        props.event._id,
        props.event.counts?.going,
        props.event.counts?.maybe,
        props.event.counts?.not_going,
        props.event.counts?.waiting,
        props.event.status,
      ] as const,
    ([id]) => client().serverEvents.fetchStats(props.serverId, id),
  );

  const days = () => {
    const list = stats.latest?.registrations ?? [];
    return list.slice(-14).map((day) => ({
      ...day,
      total: day.going + day.maybe + day.not_going,
    }));
  };
  const most = () => Math.max(1, ...days().map((day) => day.total));
  const answered = () => {
    const counts = stats.latest?.counts;
    return counts
      ? counts.going + counts.maybe + counts.not_going + (counts.waiting ?? 0)
      : 0;
  };
  const fill = () => {
    const now = stats.latest;
    if (!now?.capacity) return undefined;
    return Math.round((now.counts.going / now.capacity) * 100);
  };

  return (
    <Box data-testid="event-stats">
      <Switch>
        <Match when={stats.latest?.counts && stats.latest}>
          {(now) => (
            <>
              <Tiles>
                <Tile>
                  <b data-testid="event-stats-answered">{answered()}</b>
                  <span>
                    <Trans>Answers</Trans>
                  </span>
                </Tile>
                <Tile>
                  <b>{now().counts.going}</b>
                  <span>
                    <Trans context="event answer">Going</Trans>
                  </span>
                </Tile>
                <Show when={fill() !== undefined}>
                  <Tile>
                    <b data-testid="event-stats-fill">{fill()}%</b>
                    <span>
                      <Trans>Seats taken</Trans>
                    </span>
                  </Tile>
                </Show>
                <Show when={now().counts.waiting}>
                  <Tile>
                    <b>{now().counts.waiting}</b>
                    <span>
                      <Trans>Waiting</Trans>
                    </span>
                  </Tile>
                </Show>
                <Show when={now().present_at_start != null}>
                  <Tile>
                    <b>{now().present_at_start}</b>
                    <span>
                      <Trans>In voice at the start</Trans>
                    </span>
                  </Tile>
                </Show>
              </Tiles>
              <Show
                when={days().length}
                fallback={
                  <Note>
                    <Trans>Nobody has answered yet.</Trans>
                  </Note>
                }
              >
                <ChartTitle>
                  <Trans>Answers by day</Trans>
                </ChartTitle>
                <Chart role="list" data-testid="event-stats-days">
                  <For each={days()}>
                    {(day) => (
                      <Day role="listitem">
                        <time datetime={day.day}>
                          {dayLabel(day.day, i18n().locale ?? "en")}
                        </time>
                        <Track>
                          <Bar
                            style={{
                              width: `${Math.max(4, (day.total / most()) * 100)}%`,
                            }}
                          />
                        </Track>
                        <b
                          aria-label={t`${day.total} answers, ${day.going} going`}
                        >
                          {day.total}
                        </b>
                      </Day>
                    )}
                  </For>
                </Chart>
              </Show>
              <Show when={now().present_at_start != null}>
                <Note>
                  <Plural
                    value={now().present_at_start ?? 0}
                    one="# person was in the voice channel when it started. Only the number is kept."
                    other="# people were in the voice channel when it started. Only the number is kept."
                  />
                </Note>
              </Show>
            </>
          )}
        </Match>
        <Match when={stats.error}>
          <Note role="alert">
            <TranslatedError error={stats.error} />
          </Note>
          <Button size="sm" variant="tonal" onPress={() => void refetch()}>
            <Trans>Try again</Trans>
          </Button>
        </Match>
        <Match when={true}>
          <Note aria-busy="true">
            <Trans>Loading the numbers…</Trans>
          </Note>
        </Match>
      </Switch>
    </Box>
  );
}

const Box = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "12px",
    minWidth: 0,
  },
});

const Tiles = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
    gap: "8px",
  },
});

const Tile = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "10px 12px",
    minWidth: 0,
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "var(--z-bg-input)",
    "& b": {
      fontSize: "18px",
      lineHeight: "24px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& span": {
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const ChartTitle = styled("h4", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 650,
    color: "var(--z-fg-muted)",
  },
});

const Chart = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "6px" },
});

const Day = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "56px minmax(0, 1fr) 28px",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
    "& b": {
      fontWeight: 650,
      color: "var(--z-fg-primary)",
      textAlign: "end",
    },
  },
});

const Track = styled("div", {
  base: {
    height: "8px",
    borderRadius: "999px",
    background: "var(--z-bg-input)",
    overflow: "hidden",
  },
});

const Bar = styled("div", {
  base: {
    height: "100%",
    borderRadius: "999px",
    background: "var(--z-accent)",
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
