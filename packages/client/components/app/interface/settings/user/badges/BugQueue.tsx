import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { Dialog, FloatingSelect, MenuItem } from "@revolt/ui";

import { useDate } from "../profile/CommunityParts";
import { creatorName } from "../profile/communityApi";

import { useBugStatus } from "./BugReportDialog";
import { BugReportReview, BugReviewAction, bugsApi } from "./badgesApi";
import { Actions, Empty, ErrorText, Field, List, Pill, Row } from "./parts";

/**
 * Reviewer queue. Bug reviewers see bugs and feedback; security reports
 * only appear (in their own tab) for `bugs.security`. Confirming or fixing
 * a report verifies it, which gives its reporter Bug Hunter.
 */
export function BugQueue(props: {
  show: boolean;
  onClose: () => void;
  review: boolean;
  security: boolean;
}) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const describeError = useError();
  const date = useDate();
  const statusLabel = useBugStatus();

  const [security, setSecurity] = createSignal(!props.review);
  const [status, setStatus] = createSignal("Open,Triaged,NeedsInfo");
  const [note, setNote] = createSignal("");
  const [severity, setSeverity] = createSignal("");
  const [duplicate, setDuplicate] = createSignal("");
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  const [queue, { refetch }] = createResource(
    () => (props.show ? { security: security(), status: status() } : undefined),
    (options) =>
      bugsApi.queue(client(), options.status, options.security || undefined),
  );

  async function act(entry: BugReportReview, action: BugReviewAction) {
    setBusy(true);
    setError(undefined);
    try {
      await bugsApi.review(client(), entry.report._id, {
        action,
        note: note() || undefined,
        severity: severity() || undefined,
        duplicate_of:
          action === "duplicate"
            ? duplicate() || entry.possible_duplicates[0]
            : undefined,
        updated_at: entry.report.updated_at,
      });
      setNote("");
      setDuplicate("");
      await refetch();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      tone="settings"
      iconName="bug"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Bug reports</Trans>}
      size="xl"
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
        <Actions role="tablist">
          <Show when={props.review}>
            <button
              type="button"
              role="tab"
              aria-selected={!security()}
              aria-pressed={!security()}
              onClick={() => setSecurity(false)}
            >
              <Trans>Bugs and feedback</Trans>
            </button>
          </Show>
          <Show when={props.security}>
            <button
              type="button"
              role="tab"
              aria-selected={security()}
              aria-pressed={security()}
              onClick={() => setSecurity(true)}
            >
              <Trans>Security (private)</Trans>
            </button>
          </Show>
        </Actions>
        <Row>
          <Field>
            <span>
              <Trans>Show</Trans>
            </span>
            <FloatingSelect
              value={status()}
              onChange={(e) => setStatus(e.currentTarget.value)}
            >
              <MenuItem value="Open,Triaged,NeedsInfo">{t`Waiting for review`}</MenuItem>
              <MenuItem value="Confirmed,Fixed">{t`Verified`}</MenuItem>
              <MenuItem value="Duplicate,NotABug">{t`Closed`}</MenuItem>
            </FloatingSelect>
          </Field>
          <Field>
            <span>
              <Trans>Severity</Trans>
            </span>
            <FloatingSelect
              value={severity()}
              onChange={(e) => setSeverity(e.currentTarget.value)}
            >
              <MenuItem value="">{t`Unchanged`}</MenuItem>
              <MenuItem value="low">{t`Low`}</MenuItem>
              <MenuItem value="medium">{t`Medium`}</MenuItem>
              <MenuItem value="high">{t`High`}</MenuItem>
              <MenuItem value="critical">{t`Critical`}</MenuItem>
            </FloatingSelect>
          </Field>
        </Row>
        <Field>
          <span>
            <Trans>Note to the reporter</Trans>
          </span>
          <input
            maxLength={1000}
            value={note()}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
        </Field>
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>
        <List>
          <Show when={!queue.loading && !queue()?.length}>
            <Empty>
              <Trans>Nothing here.</Trans>
            </Empty>
          </Show>
          <For each={queue()}>
            {(entry) => (
              <article
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  gap: "6px",
                  padding: "10px 12px",
                  border: "1px solid var(--z-border-subtle)",
                  "border-radius": "12px",
                  background: "var(--z-bg-raised)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    "align-items": "center",
                    "flex-wrap": "wrap",
                  }}
                >
                  <strong dir="auto">{entry.report.title}</strong>
                  <Pill
                    data-tone={entry.report.verified ? "accent" : undefined}
                  >
                    {statusLabel(entry.report.status)}
                  </Pill>
                  <Show when={entry.report.severity}>
                    <Pill data-tone="warn">{entry.report.severity}</Pill>
                  </Show>
                  <small style={{ color: "var(--z-fg-muted)" }}>
                    {entry.author
                      ? creatorName(entry.author)
                      : entry.report.author_id}{" "}
                    · {entry.report.platform} · {date(entry.report.created_at)}
                  </small>
                </div>
                <p
                  dir="auto"
                  style={{
                    margin: 0,
                    "font-size": "13px",
                    "white-space": "pre-wrap",
                  }}
                >
                  {entry.report.description}
                </p>
                <Show when={entry.report.steps}>
                  <p
                    dir="auto"
                    style={{
                      margin: 0,
                      "font-size": "12.5px",
                      "white-space": "pre-wrap",
                      color: "var(--z-fg-secondary)",
                    }}
                  >
                    {entry.report.steps}
                  </p>
                </Show>
                <Show when={entry.report.attachments.length}>
                  <div
                    style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}
                  >
                    <For each={entry.report.attachments}>
                      {(file) => (
                        <a
                          href={`${instance.mediaUrl}/attachments/${file._id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={`${instance.mediaUrl}/attachments/${file._id}`}
                            alt={t`Screenshot`}
                            width="96"
                            height="64"
                            style={{
                              "object-fit": "cover",
                              "border-radius": "8px",
                            }}
                          />
                        </a>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={entry.possible_duplicates.length}>
                  <small>
                    <Trans>
                      Possible duplicates:{" "}
                      {entry.possible_duplicates.join(", ")}
                    </Trans>
                  </small>
                </Show>
                <Actions>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void act(entry, "triage")}
                  >
                    <Trans>Triage</Trans>
                  </button>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void act(entry, "need_info")}
                  >
                    <Trans>Needs info</Trans>
                  </button>
                  <button
                    type="button"
                    data-primary
                    disabled={busy()}
                    onClick={() => void act(entry, "confirm")}
                  >
                    <Trans>Confirm</Trans>
                  </button>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void act(entry, "fix")}
                  >
                    <Trans>Fixed</Trans>
                  </button>
                  <Show when={entry.possible_duplicates.length}>
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() => void act(entry, "duplicate")}
                    >
                      <Trans>Duplicate</Trans>
                    </button>
                  </Show>
                  <button
                    type="button"
                    data-danger
                    disabled={busy()}
                    onClick={() => void act(entry, "not_a_bug")}
                  >
                    <Trans>Not a bug</Trans>
                  </button>
                </Actions>
              </article>
            )}
          </For>
        </List>
      </div>
    </Dialog>
  );
}
