import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSafetyLabels } from "../../../safety/labels";
import {
  SafetyReceipt,
  CONTACT_EMAIL,
  SafetyCategory,
  SafetyStandingEntry,
  SafetyStandingLevel,
  decisionReference,
  safetyApi,
  safetyErrorType,
} from "../../../safety/safetyApi";
import {
  Buttons,
  Empty,
  ErrorText,
  Field,
  Notice,
  Pill,
  Stack,
} from "../../../safety/styles";

const LEVELS: SafetyStandingLevel[] = [
  "Good",
  "Limited",
  "VeryLimited",
  "AtRisk",
  "Suspended",
];

export function formatDate(ms: number) {
  return new Date(ms).toLocaleString(
    document.documentElement.lang || undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

/**
 * Account standing (what was done to your account, with appeals) and the
 * reports you sent. Nothing here shows who reported you or reviewer notes:
 * the server never sends them.
 */
export function ReportsAndStanding() {
  const { t } = useLingui();
  const client = useClient();
  const labels = useSafetyLabels();

  const [standing, { refetch: refetchStanding }] = createResource(() =>
    safetyApi.standing(client()),
  );
  const [reports, { refetch: refetchReports }] = createResource(() =>
    safetyApi.myReports(client()),
  );

  return (
    <Page>
      <Section aria-labelledby="standing-title">
        <h2 id="standing-title">
          <Trans>Account standing</Trans>
        </h2>
        <Switch>
          <Match when={standing.loading}>
            <Empty>
              <Trans>Loading…</Trans>
            </Empty>
          </Match>
          <Match when={standing.error}>
            <Empty>
              <Trans>Your account standing couldn't be loaded.</Trans>
              <button type="button" onClick={() => void refetchStanding()}>
                <Trans>Try again</Trans>
              </button>
            </Empty>
          </Match>
          <Match when={standing()}>
            {(current) => (
              <Stack>
                <Meter data-level={current().level}>
                  <ol aria-label={t`Standing`}>
                    <For each={LEVELS}>
                      {(level) => (
                        <li
                          aria-current={level === current().level || undefined}
                        >
                          <span>{labels.standing[level].name}</span>
                        </li>
                      )}
                    </For>
                  </ol>
                  <p>
                    <strong>{labels.standing[current().level].name}</strong>
                    {" — "}
                    {labels.standing[current().level].description}
                  </p>
                </Meter>
                <Show
                  when={current().entries.length}
                  fallback={
                    <Notice>
                      <Trans>No actions have been taken on your account.</Trans>
                    </Notice>
                  }
                >
                  <List>
                    <For each={current().entries}>
                      {(entry) => (
                        <StandingRow
                          entry={entry}
                          outOfCourt={current().out_of_court_body}
                          onAppealed={() => void refetchStanding()}
                        />
                      )}
                    </For>
                  </List>
                </Show>
              </Stack>
            )}
          </Match>
        </Switch>
      </Section>

      <Section aria-labelledby="reports-title">
        <h2 id="reports-title">
          <Trans>Your reports</Trans>
        </h2>
        <p>
          <Trans>
            Reports you sent to Zrzur Trust & Safety. The people you report
            never see your name.
          </Trans>
        </p>
        <Switch>
          <Match when={reports.loading}>
            <Empty>
              <Trans>Loading…</Trans>
            </Empty>
          </Match>
          <Match when={reports.error}>
            <Empty>
              <Trans>Your reports couldn't be loaded.</Trans>
              <button type="button" onClick={() => void refetchReports()}>
                <Trans>Try again</Trans>
              </button>
            </Empty>
          </Match>
          <Match when={!reports()?.length}>
            <Empty>
              <Icon name="shield-check" size={22} />
              <Trans>You haven't reported anything.</Trans>
            </Empty>
          </Match>
          <Match when={reports()}>
            <List>
              <For each={reports()}>
                {(report) => (
                  <ReportRow
                    report={report}
                    onReplied={() => void refetchReports()}
                  />
                )}
              </For>
            </List>
          </Match>
        </Switch>
      </Section>
    </Page>
  );
}

/**
 * The statement of reasons for one decision (DSA Art. 17): what happened,
 * the ground, whether machines were involved, where and how long it applies,
 * how to appeal and the out-of-court option.
 */
function Statement(props: {
  entry: SafetyStandingEntry;
  outOfCourt?: string;
}) {
  const { t } = useLingui();
  const labels = useSafetyLabels();
  const yes = () => <Trans>yes</Trans>;
  const no = () => <Trans>no</Trans>;
  const ground = props.entry.ground;
  const contact = CONTACT_EMAIL;
  const reference = decisionReference(props.entry.action_id);
  // `rule:<Category>` is shown by its translated name; other text as written
  const rawRule = ground?.type === "Terms" ? ground.rule : "";
  const named = rawRule.startsWith("rule:")
    ? labels.category[rawRule.slice(5) as SafetyCategory]?.name
    : undefined;
  // actions older than statements of reasons say only this
  const rule =
    named ?? (rawRule === "Terms of Service" ? t`Terms of Service` : rawRule);
  const law = ground?.type === "Law" ? ground.law : "";
  const provision = ground?.type === "Law" ? ground.provision : "";
  return (
    <Facts data-testid="decision-statement">
      {/* older decisions may not say what they followed */}
      <Show when={props.entry.basis && props.entry.basis !== "Unknown"}>
        <div>
          <dt>
            <Trans>What this followed</Trans>
          </dt>
          <dd>
            <Switch
              fallback={<Trans>A report from another person.</Trans>}
            >
              <Match when={props.entry.basis === "Notice"}>
                <Trans>A notice of illegal content.</Trans>
              </Match>
              <Match when={props.entry.basis === "OwnInitiative"}>
                <Trans>Our own review.</Trans>
              </Match>
            </Switch>
          </dd>
        </div>
      </Show>
      <div>
        <dt>
          <Trans>What happened</Trans>
        </dt>
        <dd dir="auto">{props.entry.facts || props.entry.public_reason}</dd>
      </div>
      <div>
        <dt>
          <Trans>Ground</Trans>
        </dt>
        <dd dir="auto">
          <Show
            when={ground?.type === "Law"}
            fallback={
              <Trans>
                Breaks our rules: {rule}. This is not a finding that it is
                illegal.
              </Trans>
            }
          >
            <Trans>
              Illegal under {law}, {provision}
            </Trans>
          </Show>
        </dd>
      </div>
      <div>
        <dt>
          <Trans>Automated tools</Trans>
        </dt>
        <dd>
          <Trans>Used to find it:</Trans>{" "}
          {props.entry.automated_detection ? yes() : no()}
          {" · "}
          <Trans>Used to decide:</Trans>{" "}
          {props.entry.automated_decision ? yes() : no()}
        </dd>
      </div>
      <div>
        <dt>
          <Trans>Where it applies</Trans>
        </dt>
        <dd dir="auto">
          <Show
            when={
              props.entry.territorial_scope &&
              props.entry.territorial_scope.toLowerCase() !== "worldwide"
            }
            fallback={<Trans>Worldwide</Trans>}
          >
            {props.entry.territorial_scope}
          </Show>
        </dd>
      </div>
      <Show when={props.entry.appealable}>
        <div>
          <dt>
            <Trans>How to appeal</Trans>
          </dt>
          <dd>
            <Trans>
              Use Appeal below. You can appeal for at least 6 months after the
              decision. If you cannot sign in, write to {contact} and give the
              reference {reference}. A person reviews it.
            </Trans>
          </dd>
        </div>
      </Show>
      <div>
        <dt>
          <Trans>Out-of-court settlement</Trans>
        </dt>
        <dd>
          <Trans>
            You can also take this to a certified out-of-court dispute
            settlement body of your choice (Article 21 of the Digital Services
            Act). It does not affect your right to go to court.
          </Trans>{" "}
          <Trans>
            The European Commission publishes the list of certified bodies on
            its website.
          </Trans>
          <Show when={props.outOfCourt}>
            {" "}
            <strong dir="auto">
              <Trans>Zrzur also works with:</Trans> {props.outOfCourt}
            </strong>
          </Show>
        </dd>
      </div>
      <div>
        <dt>
          <Trans>Questions</Trans>
        </dt>
        <dd dir="ltr">{contact}</dd>
      </div>
    </Facts>
  );
}

function StandingRow(props: {
  entry: SafetyStandingEntry;
  outOfCourt?: string;
  onAppealed: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const labels = useSafetyLabels();
  const describeError = useError();
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function send() {
    if (busy()) return;
    setBusy(true);
    setError(undefined);
    try {
      await safetyApi.appeal(client(), props.entry.action_id, text().trim());
      setOpen(false);
      props.onAppealed();
    } catch (failure) {
      setError(
        safetyErrorType(failure) === "InvalidOperation"
          ? t`This action can't be appealed, or you already appealed it.`
          : describeError(failure),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row>
      <header>
        <strong>{labels.action[props.entry.kind]}</strong>
        <Pill>{labels.category[props.entry.category].name}</Pill>
        <Show when={props.entry.revoked}>
          <Pill data-tone="ok">
            <Trans>Reversed</Trans>
          </Pill>
        </Show>
        <Show when={!props.entry.revoked && props.entry.active}>
          <Pill data-tone="warn">
            <Trans>Active</Trans>
          </Pill>
        </Show>
        <Show when={props.entry.appeal_status}>
          {(status) => (
            <Pill data-tone="accent">{labels.appeal[status()]}</Pill>
          )}
        </Show>
      </header>
      <p dir="auto">{props.entry.public_reason}</p>
      <small>
        <time>{formatDate(props.entry.created_at)}</time>
        <Show when={props.entry.expires_at}>
          {(at) => (
            <>
              {" · "}
              <Trans>Ends</Trans> <time>{formatDate(at())}</time>
            </>
          )}
        </Show>
      </small>
      <Statement entry={props.entry} outOfCourt={props.outOfCourt} />
      <Show when={props.entry.appeal_note}>
        {(note) => (
          <Notice>
            <Trans>Reviewer's answer:</Trans> <span dir="auto">{note()}</span>
          </Notice>
        )}
      </Show>
      <Show when={props.entry.appealable}>
        <Show
          when={open()}
          fallback={
            <Buttons>
              <button type="button" onClick={() => setOpen(true)}>
                <Trans>Appeal</Trans>
              </button>
            </Buttons>
          }
        >
          <Field>
            <span>
              <Trans>Why should we look at this again?</Trans>
            </span>
            <textarea
              dir="auto"
              maxLength={2000}
              value={text()}
              onInput={(event) => setText(event.currentTarget.value)}
            />
            <small>
              <Trans>
                Appealing doesn't lift anything by itself. A different reviewer
                decides.
              </Trans>
            </small>
          </Field>
          <Show when={error()}>
            <ErrorText role="alert">{error()}</ErrorText>
          </Show>
          <Buttons>
            <button
              type="button"
              disabled={busy()}
              onClick={() => setOpen(false)}
            >
              <Trans>Cancel</Trans>
            </button>
            <button
              type="button"
              data-primary
              disabled={busy() || text().trim().length < 10}
              onClick={() => void send()}
            >
              <Trans>Send appeal</Trans>
            </button>
          </Buttons>
        </Show>
      </Show>
    </Row>
  );
}

function ReportRow(props: { report: SafetyReceipt; onReplied: () => void }) {
  const client = useClient();
  const labels = useSafetyLabels();
  const describeError = useError();
  const [text, setText] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function reply() {
    if (busy()) return;
    setBusy(true);
    setError(undefined);
    try {
      await safetyApi.reply(client(), props.report._id, text().trim());
      setText("");
      props.onReplied();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  const tone = () =>
    ({
      Submitted: undefined,
      InReview: "accent",
      NeedsInfo: "warn",
      ActionTaken: "ok",
      NoViolation: undefined,
      Closed: undefined,
    })[props.report.status];

  return (
    <Row>
      <header>
        <bdi dir="ltr">
          <code>{props.report.reference}</code>
        </bdi>
        <Pill>{labels.kind[props.report.target_kind]}</Pill>
        <Pill data-tone={tone()}>{labels.receipt[props.report.status]}</Pill>
      </header>
      <p>{labels.category[props.report.category].name}</p>
      <small>
        <time>{formatDate(props.report.created_at)}</time>
      </small>
      <Show when={props.report.public_note}>
        {(note) => (
          <Notice>
            <span dir="auto">{note()}</span>
          </Notice>
        )}
      </Show>
      <Show
        when={props.report.status === "NeedsInfo" && props.report.info_request}
      >
        {(request) => (
          <>
            <Notice>
              <Trans>A reviewer asked:</Trans>{" "}
              <span dir="auto">{request()}</span>
            </Notice>
            <Field>
              <span>
                <Trans>Your answer</Trans>
              </span>
              <textarea
                dir="auto"
                maxLength={1000}
                value={text()}
                onInput={(event) => setText(event.currentTarget.value)}
              />
            </Field>
            <Show when={error()}>
              <ErrorText role="alert">{error()}</ErrorText>
            </Show>
            <Buttons>
              <button
                type="button"
                data-primary
                disabled={busy() || !text().trim()}
                onClick={() => void reply()}
              >
                <Trans>Send</Trans>
              </button>
            </Buttons>
          </>
        )}
      </Show>
    </Row>
  );
}

const Page = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    color: "var(--z-fg-primary)",
  },
});

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    // same section titles as SettingsSection
    "& h2": {
      margin: 0,
      paddingInline: "2px",
      fontSize: "12px",
      fontWeight: 600,
      color: "var(--z-fg-muted)",
    },
    "& > p": {
      margin: "0 2px",
      fontSize: "13px",
      lineHeight: "18px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Meter = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "14px",
    borderRadius: "14px",
    background: "var(--z-bg-input)",
    "& ol": {
      margin: 0,
      padding: 0,
      listStyle: "none",
      display: "grid",
      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
      gap: "4px",
    },
    "& li": {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      fontSize: "12px",
      color: "var(--z-fg-muted)",
      textAlign: "center",
      _before: {
        content: '""',
        height: "6px",
        borderRadius: "999px",
        background: "var(--z-border-subtle)",
      },
    },
    "& li[aria-current]": { color: "var(--z-fg-primary)", fontWeight: 700 },
    "&[data-level='Good'] li[aria-current]::before": {
      background: "var(--z-status-success, #55DCC8)",
    },
    "&[data-level='Limited'] li[aria-current]::before": {
      background: "#f5b942",
    },
    "&[data-level='VeryLimited'] li[aria-current]::before": {
      background: "#f08a42",
    },
    "&[data-level='AtRisk'] li[aria-current]::before, &[data-level='Suspended'] li[aria-current]::before":
      { background: "var(--z-danger, #F27488)" },
    "& p": { margin: 0, fontSize: "14px" },
  },
});

const List = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const Facts = styled("dl", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    fontSize: "13px",
    "& dt": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
    },
    "& dd": {
      margin: 0,
      color: "var(--z-fg-primary)",
      lineHeight: 1.5,
      overflowWrap: "anywhere",
    },
  },
});

const Row = styled("article", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid var(--z-border-subtle)",
    "& header": {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px",
    },
    "& code": { fontSize: "13px" },
    "& p": { margin: 0, fontSize: "14px", overflowWrap: "anywhere" },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});
