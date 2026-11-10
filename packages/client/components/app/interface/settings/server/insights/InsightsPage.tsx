import {
  type JSX,
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onMount,
} from "solid-js";

import { i18n } from "@lingui/core";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import type { API, Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Button, Segmented } from "@revolt/ui";

import { Anchor, PageStack } from "../layout";

import {
  type InsightsDay,
  type InsightsSeries,
  type Range,
  RANGES,
  barHeights,
  formatDay,
  formatMinutes,
  hasActivity,
  perDay,
  shares,
  viewerTimeZone,
} from "./insightsData";

type Insights = API.ServerInsights;

/**
 * Server insights: how the server is doing, as daily totals. Loaded on its
 * own (lazy) when the page opens; one request per range, kept while the
 * page is open so switching back is instant.
 *
 * Charts are bars in a flex row, so in Arabic the time axis runs from right
 * (oldest) to left (today), the reading direction, like the rest of the
 * page. Days are counted in the viewer's time zone by the server.
 */
export default function InsightsPage(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const [range, setRange] = createSignal<Range>(30);
  const zone = viewerTimeZone();
  const cache = new Map<Range, Insights>();

  onMount(() => performance.mark("zrzur-insights-open"));

  const [data, { refetch }] = createResource(range, async (days) => {
    const known = cache.get(days);
    if (known) return known;
    const result = await props.server.fetchInsights({
      days,
      timeZone: zone.time_zone,
      utcOffset: zone.utc_offset,
    });
    cache.set(days, result);
    return result;
  });

  // reading an errored resource throws: only read it when it holds data
  const value = () =>
    data.state === "ready" || data.state === "refreshing" ? data() : undefined;
  const locale = () => i18n.locale || "en";
  const number = createMemo(() => new Intl.NumberFormat(locale()));
  const rows = createMemo(() => (value()?.rows ?? []) as InsightsDay[]);
  const membersNow = () => rows()[rows().length - 1]?.members ?? 0;
  const membersChange = () => membersNow() - (rows()[0]?.members ?? 0);
  const totals = () => value()?.totals;
  const few = () => t`fewer than 5`;
  /** A count that can be hidden: null is 1 to 4 */
  const maybe = (
    n: number | null | undefined,
    format: (n: number) => string = (n) => number().format(n),
  ) => (n === null ? few() : format(n ?? 0));

  const sources = createMemo(() => {
    const s = value()?.join_sources;
    const counts = [s?.invite, s?.discover, s?.vanity, s?.other].map((n) =>
      n === undefined ? 0 : n,
    );
    const percent = shares(counts);
    return [
      {
        id: "invite",
        label: t`Invite links`,
        count: counts[0],
        percent: percent[0],
      },
      {
        id: "discover",
        label: t({ message: "Discover", context: "server insights" }),
        count: counts[1],
        percent: percent[1],
      },
      {
        id: "vanity",
        label: t`Custom link`,
        count: counts[2],
        percent: percent[2],
      },
      {
        id: "other",
        label: t`Other ways`,
        count: counts[3],
        percent: percent[3],
      },
    ];
  });

  const channelName = (id: string) =>
    client().channels.get(id)?.name ?? t`Unknown channel`;

  // the first time numbers show, for the e2e timing (Performance API)
  let marked = false;
  const ready = () => {
    if (!value()) return false;
    if (!marked) {
      marked = true;
      queueMicrotask(() => performance.mark("zrzur-insights-ready"));
    }
    return true;
  };

  return (
    <PageStack>
      {/* the page title and its line come from the settings sidebar */}
      <Anchor id="insights">
        <Toolbar>
          <Segmented<`${Range}`>
            aria-label={t`Time range`}
            value={`${range()}`}
            onChange={(value) => setRange(Number(value) as Range)}
            options={RANGES.map((days) => ({
              value: `${days}` as `${Range}`,
              label: t`${plural(days, { one: "# day", other: "# days" })}`,
            }))}
          />
          <Note data-testid="insights-zone">
            <Trans>
              Days in your time ({value()?.time_zone ?? zone.time_zone ?? "UTC"}
              ). Updated every hour.
            </Trans>
          </Note>
          <Show when={value()?.counted_since}>
            {(since) => (
              <Note data-testid="insights-since">
                {t`Counted since ${formatDay(since(), locale(), true)}.`}
              </Note>
            )}
          </Show>
        </Toolbar>

        <Switch>
          <Match when={data.error}>
            <ErrorBox role="alert" data-testid="insights-error">
              {/* Solid wraps a thrown API answer in an Error; show the answer */}
              <TranslatedError error={data.error?.cause ?? data.error} />
              <div>
                <Button size="sm" variant="tonal" onPress={() => refetch()}>
                  <Trans>Try again</Trans>
                </Button>
              </div>
            </ErrorBox>
          </Match>
          <Match when={!ready()}>
            <Note aria-busy="true" data-testid="insights-loading">
              <Trans>Loading insights…</Trans>
            </Note>
          </Match>
          <Match when={ready()}>
            <Show when={!hasActivity(rows())}>
              <Card data-testid="insights-empty">
                <Trans>
                  Nothing counted yet. Joins show at once, messages within an
                  hour.
                </Trans>
              </Card>
            </Show>

            <Grid data-testid="insights-cards">
              <Stat
                id="members"
                title={t({ message: "Members", context: "server insights" })}
                value={number().format(membersNow())}
                detail={t`${signed(membersChange(), number())} in this range`}
                rows={rows()}
                series="members"
                fromMin
                locale={locale()}
                format={(n) => maybe(n)}
              />
              <Stat
                id="joins"
                title={t({ message: "Joined", context: "server insights" })}
                value={maybe(totals()?.joins)}
                detail={t`Left: ${maybe(totals()?.leaves)}`}
                rows={rows()}
                series="joins"
                locale={locale()}
                format={(n) => maybe(n)}
              />
              <Stat
                id="messages"
                title={t({ message: "Messages", context: "server insights" })}
                value={maybe(totals()?.messages)}
                detail={t`${maybe(
                  totals()?.messages === null
                    ? null
                    : perDay(totals()?.messages ?? 0, rows().length),
                )} a day on average`}
                rows={rows()}
                series="messages"
                locale={locale()}
                format={(n) => maybe(n)}
              />
              <Stat
                id="active"
                title={t`Active members`}
                value={maybe(totals()?.active_members)}
                detail={t`people who wrote, a day on average`}
                rows={rows()}
                series="active_members"
                locale={locale()}
                format={(n) => maybe(n)}
              />
              <Stat
                id="voice"
                title={t`Time in voice`}
                value={maybe(totals()?.voice_minutes, (n) =>
                  formatMinutes(n, locale()),
                )}
                detail={t`all voice channels together`}
                rows={rows()}
                series="voice_minutes"
                locale={locale()}
                format={(n) => maybe(n, (m) => formatMinutes(m, locale()))}
              />
            </Grid>

            <Columns>
              <Card data-testid="insights-sources">
                <h3>
                  <Trans>Where joins came from</Trans>
                </h3>
                <List>
                  <For each={sources()}>
                    {(source) => (
                      <li data-source={source.id}>
                        <Line>
                          <span>{source.label}</span>
                          <strong>{maybe(source.count)}</strong>
                        </Line>
                        <Track aria-hidden="true">
                          <Fill
                            style={{ "inline-size": `${source.percent}%` }}
                          />
                        </Track>
                      </li>
                    )}
                  </For>
                </List>
              </Card>

              <Card data-testid="insights-channels">
                <h3>
                  <Trans>Busiest channels</Trans>
                </h3>
                <Show
                  when={value()!.top_channels.length}
                  fallback={
                    <Muted>
                      <Trans>No messages in this range yet.</Trans>
                    </Muted>
                  }
                >
                  <List as="ol">
                    <For each={value()!.top_channels}>
                      {(row, index) => (
                        <li data-channel={row.channel}>
                          <Line>
                            <span>
                              {number().format(index() + 1)}. #
                              {channelName(row.channel)}
                            </span>
                            <strong>{maybe(row.messages)}</strong>
                          </Line>
                        </li>
                      )}
                    </For>
                  </List>
                </Show>
              </Card>
            </Columns>

            <Muted>
              <Trans>
                Only totals, never who. Every count from 1 to 4 except the
                member total shows as “fewer than 5”, bots are not counted as
                active members or in voice time, and messages count only in
                channels you can see. Counts are kept for 90 days.
              </Trans>
            </Muted>
          </Match>
        </Switch>
      </Anchor>
    </PageStack>
  );
}

function signed(value: number, format: Intl.NumberFormat) {
  return value > 0 ? `+${format.format(value)}` : format.format(value);
}

/** One number with its bars, a bar per day */
function Stat(props: {
  id: string;
  title: string;
  value: string;
  detail: string;
  rows: InsightsDay[];
  series: InsightsSeries;
  fromMin?: boolean;
  locale: string;
  format: (n: number | null) => string;
}): JSX.Element {
  const heights = createMemo(() =>
    barHeights(
      props.rows.map((row) => row[props.series]),
      props.fromMin,
    ),
  );
  const label = () => {
    const first = props.rows[0];
    const last = props.rows[props.rows.length - 1];
    if (!first || !last) return props.title;
    return `${props.title}: ${props.value}, ${formatDay(first.day, props.locale)} – ${formatDay(last.day, props.locale)}`;
  };

  return (
    <Card data-stat={props.id}>
      <h3>{props.title}</h3>
      <Value data-testid={`insights-${props.id}`}>{props.value}</Value>
      <Muted>{props.detail}</Muted>
      <Bars role="img" aria-label={label()}>
        <For each={props.rows}>
          {(row, index) => (
            <Bar
              title={`${formatDay(row.day, props.locale)}: ${props.format(row[props.series] ?? (row[props.series] === null ? null : 0))}`}
              style={{ "block-size": `${heights()[index()] ?? 0}%` }}
            />
          )}
        </For>
      </Bars>
      <Axis aria-hidden="true">
        <span>
          {props.rows[0] && formatDay(props.rows[0].day, props.locale)}
        </span>
        <span>
          {props.rows.length > 0 &&
            formatDay(props.rows[props.rows.length - 1].day, props.locale)}
        </span>
      </Axis>
    </Card>
  );
}

const Toolbar = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",
  },
});

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const Muted = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px",
    minWidth: 0,
  },
});

const Columns = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px",
    minWidth: 0,
  },
});

const Card = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
    padding: "16px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-soft)",
    background: "var(--z-card-bg, var(--z-bg-raised))",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    lineHeight: "20px",

    "& h3": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "20px",
      fontWeight: 600,
      color: "var(--z-fg-secondary)",
    },
  },
});

const ErrorBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-soft)",
    background: "var(--z-card-bg, var(--z-bg-raised))",
    color: "var(--z-status-error, var(--z-danger))",
    fontSize: "14px",
    lineHeight: "20px",
  },
});

const Value = styled("strong", {
  base: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: "var(--z-fg-primary)",
  },
});

const Bars = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-end",
    gap: "1px",
    blockSize: "48px",
    marginBlockStart: "4px",
    borderBlockEnd: "1px solid var(--z-border-soft)",
  },
});

const Bar = styled("span", {
  base: {
    flex: "1 1 0",
    minWidth: "1px",
    borderStartStartRadius: "2px",
    borderStartEndRadius: "2px",
    // data, not an action: neutral ink (the action colour is for controls)
    background: "var(--z-fg-secondary)",
    opacity: 0.85,

    "&:hover": { opacity: 1 },
  },
});

const Axis = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});

const List = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
});

const Line = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    minWidth: 0,

    "& span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& strong": {
      fontWeight: 600,
      fontVariantNumeric: "tabular-nums",
      flexShrink: 0,
    },
  },
});

const Track = styled("div", {
  base: {
    blockSize: "4px",
    marginBlockStart: "4px",
    borderRadius: "var(--z-radius-pill, 999px)",
    background: "var(--z-hover, var(--z-border-soft))",
    overflow: "hidden",
  },
});

const Fill = styled("div", {
  base: {
    blockSize: "100%",
    borderRadius: "inherit",
    // data, not an action: neutral ink (the action colour is for controls)
    background: "var(--z-fg-secondary)",
  },
});
