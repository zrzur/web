import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { Dialog, FloatingSelect, MenuItem } from "@revolt/ui";

import pkg from "../../../../../../../../package.json";
import { useDate } from "../profile/CommunityParts";

import { BugReport, NewBugReport, bugsApi, currentPlatform } from "./badgesApi";
import {
  Actions,
  Empty,
  ErrorText,
  Field,
  FilePick,
  List,
  Pill,
  Row,
} from "./parts";

const MAX_SHOTS = 4;

export function useBugStatus() {
  const { t } = useLingui();
  return (status: BugReport["status"]) =>
    ({
      Open: t`Open`,
      Triaged: t`Triaged`,
      NeedsInfo: t`Needs more info`,
      Confirmed: t`Confirmed`,
      Fixed: t`Fixed`,
      Duplicate: t`Duplicate`,
      NotABug: t`Not a bug`,
    })[status];
}

/**
 * Report a bug (with steps and screenshots), a security issue (private)
 * or beta feedback, and follow your earlier reports.
 */
export function BugReportDialog(props: {
  show: boolean;
  onClose: () => void;
  /** beta features this tester can send feedback about */
  beta: string[];
}) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const describeError = useError();
  const date = useDate();
  const statusLabel = useBugStatus();

  const [kind, setKind] = createSignal<NewBugReport["kind"]>("bug");
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [steps, setSteps] = createSignal("");
  const [expected, setExpected] = createSignal("");
  const [actual, setActual] = createSignal("");
  const [device, setDevice] = createSignal("");
  const [feature, setFeature] = createSignal("");
  const [shots, setShots] = createSignal<File[]>([]);
  const [error, setError] = createSignal<string>();
  const [sent, setSent] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  const [mine, { refetch }] = createResource(
    () => props.show,
    (show) =>
      show ? bugsApi.mine(client()) : Promise.resolve([] as BugReport[]),
  );

  function reset() {
    setTitle("");
    setDescription("");
    setSteps("");
    setExpected("");
    setActual("");
    setShots([]);
  }

  async function submit(event: Event) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setSent(false);
    try {
      const attachments: string[] = [];
      for (const file of shots()) {
        attachments.push(
          await client().uploadFile("attachments", file, instance.mediaUrl),
        );
      }
      await bugsApi.submit(client(), {
        kind: kind(),
        title: title(),
        description: description(),
        steps: steps() || undefined,
        expected: expected() || undefined,
        actual: actual() || undefined,
        platform: currentPlatform(),
        device: device() || navigator.userAgent.slice(0, 120),
        app_version: pkg.version,
        feature: kind() === "feedback" ? feature() || undefined : undefined,
        attachments,
      });
      reset();
      setSent(true);
      void refetch();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      tone="info"
      iconName="bug"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Report a bug</Trans>}
      size="xl"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", "flex-direction": "column", gap: "12px" }}
      >
        <Row>
          <Field>
            <span>
              <Trans>Type</Trans>
            </span>
            <FloatingSelect
              value={kind()}
              onChange={(e) =>
                setKind(e.currentTarget.value as NewBugReport["kind"])
              }
            >
              <MenuItem value="bug">{t`Bug`}</MenuItem>
              <MenuItem value="security">{t`Security issue (private)`}</MenuItem>
              <For each={props.beta.length || kind() === "feedback" ? [0] : []}>
                {() => <MenuItem value="feedback">{t`Beta feedback`}</MenuItem>}
              </For>
            </FloatingSelect>
          </Field>
          <Show when={kind() === "feedback"}>
            <Field>
              <span>
                <Trans>Beta feature</Trans>
              </span>
              <FloatingSelect
                value={feature()}
                onChange={(e) => setFeature(e.currentTarget.value)}
              >
                <MenuItem value="">{t`General`}</MenuItem>
                <For each={props.beta}>
                  {(id) => <MenuItem value={id}>{id}</MenuItem>}
                </For>
              </FloatingSelect>
            </Field>
          </Show>
        </Row>
        <Show when={kind() === "security"}>
          <p
            style={{
              margin: 0,
              "font-size": "13px",
              color: "var(--z-fg-secondary)",
            }}
          >
            <Trans>
              Only you and Zrzur's security reviewers can read a security
              report. Nothing about it is shown on your profile.
            </Trans>
          </p>
        </Show>
        <Field>
          <span>
            <Trans>Title</Trans>
          </span>
          <input
            required
            minLength={5}
            maxLength={120}
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </Field>
        <Field>
          <span>
            <Trans>What happened?</Trans>
          </span>
          <textarea
            required
            minLength={10}
            maxLength={4000}
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
          />
        </Field>
        <Field>
          <span>
            <Trans>Steps to reproduce</Trans>
          </span>
          <textarea
            maxLength={4000}
            value={steps()}
            onInput={(e) => setSteps(e.currentTarget.value)}
          />
        </Field>
        <Row>
          <Field>
            <span>
              <Trans>Expected</Trans>
            </span>
            <textarea
              maxLength={2000}
              value={expected()}
              onInput={(e) => setExpected(e.currentTarget.value)}
            />
          </Field>
          <Field>
            <span>
              <Trans>Actual</Trans>
            </span>
            <textarea
              maxLength={2000}
              value={actual()}
              onInput={(e) => setActual(e.currentTarget.value)}
            />
          </Field>
        </Row>
        <Row>
          <Field>
            <span>
              <Trans>Device (optional)</Trans>
            </span>
            <input
              maxLength={120}
              value={device()}
              placeholder={t`For example: Windows 11, Firefox`}
              onInput={(e) => setDevice(e.currentTarget.value)}
            />
          </Field>
          <Field>
            <span>
              <Trans>Screenshots (up to {MAX_SHOTS})</Trans>
            </span>
            {/* our own button: the browser's file input shows its own
                language and look */}
            <FilePick>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={(e) =>
                  setShots(
                    Array.from(e.currentTarget.files ?? []).slice(0, MAX_SHOTS),
                  )
                }
              />
              <span data-button>
                <Trans>Choose images</Trans>
              </span>
              <span data-status>
                <Show
                  when={shots().length}
                  fallback={<Trans>None chosen</Trans>}
                >
                  <Trans>Chosen: {shots().length}</Trans>
                </Show>
              </span>
            </FilePick>
          </Field>
        </Row>
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>
        <Show when={sent()}>
          <p role="status" style={{ margin: 0, "font-size": "13px" }}>
            <Trans>
              Thanks! Your report was sent. Reviewers will look at it.
            </Trans>
          </p>
        </Show>
        <Actions>
          <button type="submit" data-primary disabled={busy()}>
            <Trans>Send report</Trans>
          </button>
        </Actions>
      </form>

      <h3
        style={{
          "font-size": "12px",
          "text-transform": "uppercase",
          "margin-block": "18px 8px",
        }}
      >
        <Trans>My reports</Trans>
      </h3>
      <Show
        when={mine()?.length}
        fallback={
          <Empty>
            <Trans>You haven't sent any reports yet.</Trans>
          </Empty>
        }
      >
        <List>
          <For each={mine()}>
            {(report) => (
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  gap: "4px",
                  padding: "8px 10px",
                  border: "1px solid var(--z-border-subtle)",
                  "border-radius": "10px",
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
                  <strong dir="auto" style={{ "font-size": "13.5px" }}>
                    {report.title}
                  </strong>
                  <Pill data-tone={report.verified ? "accent" : undefined}>
                    {statusLabel(report.status)}
                  </Pill>
                  <Show when={report.kind === "Security"}>
                    <Pill data-tone="warn">
                      <Trans>Private</Trans>
                    </Pill>
                  </Show>
                </div>
                <small style={{ color: "var(--z-fg-muted)" }}>
                  {date(report.created_at)}
                </small>
                <Show when={report.reviewer_note}>
                  <q dir="auto" style={{ "font-size": "12.5px" }}>
                    {report.reviewer_note}
                  </q>
                </Show>
              </div>
            )}
          </For>
        </List>
      </Show>
    </Dialog>
  );
}
