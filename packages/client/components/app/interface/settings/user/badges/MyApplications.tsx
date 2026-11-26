import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Button, Dialog, SettingsRow, SettingsSection } from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";

import { useDate } from "../profile/CommunityParts";

import {
  ErrorText,
  Field,
  Hint,
  Meta,
  Pill,
  RowActions,
  TitleLine,
} from "./parts";
import {
  BadgeApplication,
  PROGRAM_BADGE,
  failureCode,
  programsApi,
} from "./programsApi";
import { useProgramText } from "./useProgramText";

/**
 * Your badge program applications: where each stands, the reasons of a
 * decision in your language, and what you can do next (continue a draft,
 * withdraw, appeal a refusal once within 30 days).
 */
export function ApplicationsSection(props: {
  applications: BadgeApplication[];
  onContinue: (application: BadgeApplication) => void;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const words = useProgramText();
  const date = useDate();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [appealing, setAppealing] = createSignal<BadgeApplication>();

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      props.onChanged();
    } catch (failure) {
      setError(words.failure(failureCode(failure)) ?? describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  const canAppeal = (application: BadgeApplication) =>
    application.status === "Refused" &&
    !application.appeal &&
    !!application.appeal_until &&
    application.appeal_until > Date.now();

  const tone = (application: BadgeApplication) =>
    application.status === "Approved"
      ? "accent"
      : application.status === "Refused" || application.status === "MoreInfo"
        ? "warn"
        : undefined;

  return (
    <SettingsSection
      title={<Trans>Your applications</Trans>}
      description={
        <Trans>
          Reviews happen when a volunteer is free; there is no promised date.
          Only you and the reviewers see what you sent.
        </Trans>
      }
    >
      <Show when={error()}>
        <ErrorText role="alert">{error()}</ErrorText>
      </Show>
      <For each={props.applications}>
        {(application) => (
          <SettingsRow
            icon={
              <BadgeMark id={PROGRAM_BADGE[application.program]} size="md" />
            }
            title={
              <TitleLine data-application={application._id}>
                {words.program(application.program)}
                <Show
                  when={
                    application.target_name &&
                    application.program !== "content_creator"
                  }
                >
                  {" · "}
                  <bdi>{application.target_name}</bdi>
                </Show>
                <Pill
                  data-tone={tone(application)}
                  data-status={application.status}
                >
                  {words.status(application.status)}
                </Pill>
              </TitleLine>
            }
            description={
              <>
                <Show when={application.creator}>
                  <Meta data-application-channel>
                    {words.platform(
                      application.creator!.platform,
                      application.creator!.platform_name,
                    )}
                    {" · "}
                    <bdi dir="ltr">{application.creator!.url}</bdi>
                  </Meta>
                </Show>
                <Show when={application.reasons.length}>
                  <ul
                    style={{ margin: "4px 0", "padding-inline-start": "18px" }}
                  >
                    <For each={application.reasons}>
                      {(code) => (
                        <li data-reason={code}>{words.reason(code)}</li>
                      )}
                    </For>
                  </ul>
                </Show>
                <Show when={application.note}>
                  <span dir="auto" style={{ display: "block" }}>
                    {application.note}
                  </span>
                </Show>
                <Show
                  when={
                    application.status === "Ended" && application.end_reason
                  }
                >
                  <span style={{ display: "block" }}>
                    {words.ended(application.end_reason)}
                  </span>
                </Show>
                <Meta>
                  <Show
                    when={application.decided_at}
                    fallback={
                      <Show when={application.submitted_at}>
                        <Trans>Sent {date(application.submitted_at)}</Trans>
                      </Show>
                    }
                  >
                    <Trans>Decided {date(application.decided_at)}</Trans>
                  </Show>
                  <Show when={canAppeal(application)}>
                    {" · "}
                    <Trans>
                      You can appeal until {date(application.appeal_until)}
                    </Trans>
                  </Show>
                  <Show
                    when={
                      application.status === "Refused" &&
                      application.reapply_after
                    }
                  >
                    {" · "}
                    <Trans>
                      Apply again from {date(application.reapply_after)}
                    </Trans>
                  </Show>
                  <Show when={application.appeal}>
                    {" · "}
                    {application.appeal!.status === "Open" ? (
                      <Trans>Appeal sent</Trans>
                    ) : application.appeal!.status === "Upheld" ? (
                      <Trans>Appeal accepted</Trans>
                    ) : (
                      <Trans>Appeal not accepted</Trans>
                    )}
                  </Show>
                  <Show
                    when={
                      application.status === "Approved" &&
                      application.next_review_at
                    }
                  >
                    {" · "}
                    <Trans>
                      Next check around {date(application.next_review_at)}
                    </Trans>
                  </Show>
                </Meta>
              </>
            }
            control={() => (
              <RowActions>
                <Show
                  when={
                    application.status === "Draft" ||
                    application.status === "MoreInfo"
                  }
                >
                  <Button
                    size="sm"
                    variant="tonal"
                    isDisabled={busy()}
                    onPress={() => props.onContinue(application)}
                  >
                    <Trans>Continue</Trans>
                  </Button>
                </Show>
                <Show when={canAppeal(application)}>
                  <Button
                    size="sm"
                    variant="tonal"
                    isDisabled={busy()}
                    onPress={() => setAppealing(application)}
                  >
                    <Trans>Appeal</Trans>
                  </Button>
                </Show>
                <Show
                  when={["Draft", "Submitted", "InReview", "MoreInfo"].includes(
                    application.status,
                  )}
                >
                  <Button
                    size="sm"
                    variant="text"
                    isDisabled={busy()}
                    aria-label={t`Withdraw the application`}
                    onPress={() =>
                      void run(() =>
                        programsApi.withdraw(client(), application._id),
                      )
                    }
                  >
                    <Trans>Withdraw</Trans>
                  </Button>
                </Show>
              </RowActions>
            )}
          />
        )}
      </For>
      <Show when={appealing()}>
        <AppealDialog
          application={appealing()!}
          onClose={() => setAppealing(undefined)}
          onSent={() => {
            setAppealing(undefined);
            props.onChanged();
          }}
        />
      </Show>
    </SettingsSection>
  );
}

/** One appeal against a refusal, with your reasons */
function AppealDialog(props: {
  application: BadgeApplication;
  onClose: () => void;
  onSent: () => void;
}) {
  const client = useClient();
  const describeError = useError();
  const words = useProgramText();
  const [text, setText] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      await programsApi.appeal(client(), props.application._id, text());
      props.onSent();
    } catch (failure) {
      setError(words.failure(failureCode(failure)) ?? describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      tone="settings"
      show
      onClose={props.onClose}
      title={<Trans>Appeal the decision</Trans>}
      size="md"
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
        <Hint>
          <Trans>
            You can appeal once. Say what the team missed or what changed; a
            person reads it.
          </Trans>
        </Hint>
        <Field>
          <span>
            <Trans>Your appeal</Trans>
          </span>
          <textarea
            maxLength={2000}
            value={text()}
            onInput={(event) => setText(event.currentTarget.value)}
          />
        </Field>
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>
        <RowActions>
          <Button
            size="sm"
            isDisabled={busy() || text().trim().length < 20}
            onPress={() => void send()}
          >
            <Trans>Send appeal</Trans>
          </Button>
        </RowActions>
      </div>
    </Dialog>
  );
}
