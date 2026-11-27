import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  Button,
  Column,
  Dialog,
  FloatingSelect,
  MenuItem,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { styled } from "styled-system/jsx";

import pkg from "../../../../../../../../package.json";
import { useDate } from "../profile/CommunityParts";

import { BugReport, NewBugReport, bugsApi, currentPlatform } from "./badgesApi";
import { ErrorText, Pill } from "./parts";

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
 * or beta feedback, and follow your earlier reports. The form alone: in its
 * own dialog (BugReportDialog) or right in a settings page.
 */
export function BugReportForm(props: {
  /** while shown: earlier reports are loaded then */
  active?: boolean;
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
    () => props.active ?? true,
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

  let picker: HTMLInputElement | undefined;

  return (
    <Column gap="xl">
      {/* the settings' own pieces: rows, fields, one main button */}
      <form onSubmit={submit}>
        <Column gap="xl">
          <SettingsSection>
            <SettingsRow
              icon={<Icon name="bug" size={20} />}
              title={<Trans>Type</Trans>}
              description={
                kind() === "security" ? (
                  <Trans>
                    Only you and Zrzur's security reviewers can read it.
                  </Trans>
                ) : undefined
              }
              control={(ids) => (
                <FloatingSelect
                  aria-labelledby={ids.labelId}
                  value={kind()}
                  onChange={(e) =>
                    setKind(e.currentTarget.value as NewBugReport["kind"])
                  }
                >
                  <MenuItem value="bug">{t`Bug`}</MenuItem>
                  <MenuItem value="security">
                    {t`Security issue (private)`}
                  </MenuItem>
                  <For
                    each={props.beta.length || kind() === "feedback" ? [0] : []}
                  >
                    {() => (
                      <MenuItem value="feedback">{t`Beta feedback`}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              )}
            />
            <Show when={kind() === "feedback"}>
              <SettingsRow
                icon={<Icon name="flask" size={20} />}
                title={<Trans>Beta feature</Trans>}
                control={(ids) => (
                  <FloatingSelect
                    aria-labelledby={ids.labelId}
                    value={feature()}
                    onChange={(e) => setFeature(e.currentTarget.value)}
                  >
                    <MenuItem value="">{t`General`}</MenuItem>
                    <For each={props.beta}>
                      {(id) => <MenuItem value={id}>{id}</MenuItem>}
                    </For>
                  </FloatingSelect>
                )}
              />
            </Show>
          </SettingsSection>

          <SettingsSection title={<Trans>What happened?</Trans>}>
            <SettingsFormPanel>
              <TextField
                required
                minlength={5}
                maxlength={120}
                counter
                label={t`Title`}
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
              />
              <TextField
                required
                minlength={10}
                maxlength={4000}
                rows={4}
                label={t`What happened?`}
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
              />
              <TextField
                maxlength={4000}
                rows={3}
                label={t`Steps to reproduce`}
                value={steps()}
                onInput={(e) => setSteps(e.currentTarget.value)}
              />
              <Pair>
                <TextField
                  maxlength={2000}
                  rows={2}
                  label={t`Expected`}
                  value={expected()}
                  onInput={(e) => setExpected(e.currentTarget.value)}
                />
                <TextField
                  maxlength={2000}
                  rows={2}
                  label={t`Actual`}
                  value={actual()}
                  onInput={(e) => setActual(e.currentTarget.value)}
                />
              </Pair>
              <TextField
                maxlength={120}
                label={t`Device (optional)`}
                placeholder={t`For example: Windows 11, Firefox`}
                value={device()}
                onInput={(e) => setDevice(e.currentTarget.value)}
              />
            </SettingsFormPanel>
            <SettingsRow
              icon={<Icon name="image" size={20} />}
              title={<Trans>Screenshots (up to {MAX_SHOTS})</Trans>}
              description={
                shots().length ? (
                  <Trans>Chosen: {shots().length}</Trans>
                ) : undefined
              }
              control={() => (
                <>
                  <input
                    ref={picker}
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    onChange={(e) =>
                      setShots(
                        Array.from(e.currentTarget.files ?? []).slice(
                          0,
                          MAX_SHOTS,
                        ),
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="tonal"
                    onPress={() => picker?.click()}
                  >
                    <Trans>Choose images</Trans>
                  </Button>
                </>
              )}
            />
          </SettingsSection>

          <Show when={error()}>
            <ErrorText role="alert">{error()}</ErrorText>
          </Show>
          <Show when={sent()}>
            <Sent role="status">
              <Icon name="check-circle" size={16} />
              <Trans>
                Thanks! Your report was sent. Reviewers will look at it.
              </Trans>
            </Sent>
          </Show>
          <Submit>
            <Button type="submit" variant="filled" isDisabled={busy()}>
              <Show when={busy()} fallback={<Trans>Send report</Trans>}>
                <Trans>Sending…</Trans>
              </Show>
            </Button>
          </Submit>
        </Column>
      </form>

      <SettingsSection title={<Trans>My reports</Trans>}>
        <Show
          when={mine()?.length}
          fallback={
            <SettingsRow
              icon={<Icon name="tray" size={20} />}
              title={<Trans>You haven't sent any reports yet.</Trans>}
            />
          }
        >
          <For each={mine()}>
            {(report) => (
              <SettingsRow
                icon={
                  <Icon
                    name={report.kind === "Security" ? "lock-simple" : "bug"}
                    size={20}
                  />
                }
                title={<bdi>{report.title}</bdi>}
                description={
                  <>
                    {date(report.created_at)}
                    <Show when={report.reviewer_note}>
                      {" · "}
                      <q dir="auto">{report.reviewer_note}</q>
                    </Show>
                  </>
                }
                control={() => (
                  <Pill data-tone={report.verified ? "accent" : undefined}>
                    {statusLabel(report.status)}
                  </Pill>
                )}
              />
            )}
          </For>
        </Show>
      </SettingsSection>
    </Column>
  );
}

/** two fields side by side, one under the other on a phone */
const Pair = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    _phone: { gridTemplateColumns: "1fr" },
  },
});

/** the one main action, at the end of the form */
const Submit = styled("div", {
  base: { display: "flex", justifyContent: "flex-end" },
});

const Sent = styled("p", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: 0,
    fontSize: "13px",
    color: "var(--z-success, var(--z-fg-secondary))",
    "--z-icon-color": "currentColor",
  },
});

/** The report form in a dialog of its own (from the Badges page) */
export function BugReportDialog(props: {
  show: boolean;
  onClose: () => void;
  /** beta features this tester can send feedback about */
  beta: string[];
}) {
  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Report a bug</Trans>}
      size="xl"
    >
      <BugReportForm active={props.show} beta={props.beta} />
    </Dialog>
  );
}
