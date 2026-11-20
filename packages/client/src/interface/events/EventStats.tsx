import { For, Match, Show, Switch, createResource } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Button, SettingsFormPanel, SettingsRow } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { settled } from "./settled";

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
 * Organisers: the numbers of an event, as rows of a settings group. How many
 * answered and how, how full it is, on which days people signed up, and how
 * many were in the voice channel when it started. Numbers only: no names.
 * Goes inside a SettingsSection.
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
    const list = settled(stats)?.registrations ?? [];
    return list.slice(-14).map((day) => ({
      ...day,
      total: day.going + day.maybe + day.not_going,
    }));
  };
  const most = () => Math.max(1, ...days().map((day) => day.total));
  const answered = () => {
    const counts = settled(stats)?.counts;
    return counts
      ? counts.going + counts.maybe + counts.not_going + (counts.waiting ?? 0)
      : 0;
  };
  const fill = () => {
    const now = settled(stats);
    if (!now?.capacity) return undefined;
    return Math.round((now.counts.going / now.capacity) * 100);
  };
  const number = (value: number | string, testid?: string) => () => (
    <Value data-testid={testid}>{value}</Value>
  );

  return (
    <Switch>
      <Match when={settled(stats)?.counts && settled(stats)}>
        {(now) => (
          <div data-testid="event-stats">
            <SettingsRow
              icon={<Icon name="chat-circle" size={20} />}
              title={<Trans>Answers</Trans>}
              control={number(answered(), "event-stats-answered")}
            />
            <SettingsRow
              icon={<Icon name="check" size={20} />}
              title={<Trans context="event answer">Going</Trans>}
              control={number(now().counts.going)}
            />
            <Show when={fill() !== undefined}>
              <SettingsRow
                icon={<Icon name="users-three" size={20} />}
                title={<Trans>Seats taken</Trans>}
                control={number(`${fill()}%`, "event-stats-fill")}
              />
            </Show>
            <Show when={now().counts.waiting}>
              <SettingsRow
                icon={<Icon name="hourglass" size={20} />}
                title={<Trans>Waiting</Trans>}
                control={number(now().counts.waiting ?? 0)}
              />
            </Show>
            <Show when={now().present_at_start != null}>
              <SettingsRow
                icon={<Icon name="speaker-high" size={20} />}
                title={<Trans>In voice at the start</Trans>}
                description={
                  <Trans>Only the number is kept, never who it was.</Trans>
                }
                control={number(now().present_at_start ?? 0)}
              />
            </Show>
            <Show when={days().length}>
              <SettingsFormPanel>
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
              </SettingsFormPanel>
            </Show>
          </div>
        )}
      </Match>
      <Match when={stats.error}>
        <SettingsFormPanel data-testid="event-stats">
          <Note role="alert">
            <TranslatedError error={stats.error} />
          </Note>
          <div>
            <Button size="sm" variant="tonal" onPress={() => void refetch()}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        </SettingsFormPanel>
      </Match>
      <Match when={true}>
        <SettingsFormPanel data-testid="event-stats">
          <Note aria-busy="true">
            <Trans>Loading the numbers…</Trans>
          </Note>
        </SettingsFormPanel>
      </Match>
    </Switch>
  );
}

const Value = styled("span", {
  base: {
    fontSize: "15px",
    lineHeight: "20px",
    fontWeight: 650,
    color: "var(--z-fg-primary)",
    fontVariantNumeric: "tabular-nums",
  },
});

const ChartTitle = styled("h4", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
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
