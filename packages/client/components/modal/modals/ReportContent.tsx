import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Message as MessageI, Server, User } from "@zrzur/sdk/solid";

import { useSafetyLabels } from "@revolt/app/interface/safety/labels";
import {
  ReportTargetSpec,
  SafetyCategory,
  SafetyReasonOption,
  SafetyReceipt,
  safetyApi,
  safetyErrorType,
} from "@revolt/app/interface/safety/safetyApi";
import {
  Choice,
  Choices,
  Field,
  Notice,
  Stack,
  Summary,
  TargetCard,
} from "@revolt/app/interface/safety/styles";
import { useError } from "@revolt/i18n";
import { Dialog, DialogProps } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

type Step = "reason" | "sub" | "details" | "review" | "done";

const DESCRIPTION_MAX = 1000;

/** Turn whatever was right-clicked into a report target */
function toSpec(
  target: Server | User | MessageI | ReportTargetSpec,
  contextMessage?: MessageI,
): ReportTargetSpec {
  if (target instanceof User) {
    return {
      kind: target.bot ? "Bot" : "User",
      id: target.id,
      messageId: contextMessage?.id,
      serverId: contextMessage?.channel?.serverId,
      label: target.displayName,
      image: target.animatedAvatarURL,
    };
  }
  if (target instanceof Server) {
    return {
      kind: "Server",
      id: target.id,
      label: target.name,
      image: target.animatedIconURL,
    };
  }
  if (target instanceof MessageI) {
    return {
      kind: "Message",
      id: target.id,
      label: target.content || target.author?.displayName,
      image: target.author?.animatedAvatarURL,
    };
  }
  return target;
}

/**
 * Report to Zrzur Trust & Safety: reason, optional sub-reason, details,
 * a summary, then a reference to keep. Closing (Cancel, X, Escape) never
 * sends anything; Back keeps what was entered; it sends once.
 */
export function ReportContentModal(
  props: DialogProps & Modals & { type: "report_content" },
) {
  const { t } = useLingui();
  const labels = useSafetyLabels();
  const describeError = useError();
  const { openModal } = useModals();

  // eslint-disable-next-line solid/reactivity
  const spec = toSpec(props.target, props.contextMessage);

  const [step, setStep] = createSignal<Step>("reason");
  const [category, setCategory] = createSignal<SafetyCategory>();
  const [sub, setSub] = createSignal<string>();
  const [description, setDescription] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [receipt, setReceipt] = createSignal<SafetyReceipt>();

  const [reasons, { refetch }] = createResource(() =>
    safetyApi.reasons(props.client, spec.kind),
  );
  const option = createMemo<SafetyReasonOption | undefined>(() =>
    reasons()?.find((entry) => entry.category === category()),
  );
  // the urgent reason needs no words: the sooner it is sent the better
  const descriptionOk = () =>
    sub() === "flashing" ||
    !option()?.needs_description ||
    description().trim().length >= 10;
  // flashing is about effects and other moving designs only
  const subcategories = () =>
    option()?.subcategories?.filter(
      (entry) => entry !== "flashing" || spec.kind === "CommunityItem",
    ) ?? [];

  function pick(entry: SafetyReasonOption) {
    setCategory(entry.category);
    if (sub() && !entry.subcategories?.includes(sub()!)) setSub(undefined);
    setError(undefined);
    const offered = entry.subcategories?.filter(
      (name) => name !== "flashing" || spec.kind === "CommunityItem",
    );
    setStep(offered?.length ? "sub" : "details");
  }

  function back() {
    setError(undefined);
    setStep((current) =>
      current === "review"
        ? "details"
        : current === "details" && subcategories().length
          ? "sub"
          : "reason",
    );
  }

  async function send() {
    // one report per dialog, however often the button is pressed
    if (busy() || receipt()) return;
    const chosen = category();
    if (!chosen) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await safetyApi.report(props.client, spec, {
        category: chosen,
        subcategory: sub(),
        description: description().trim() || undefined,
      });
      setReceipt(result);
      setStep("done");
    } catch (failure) {
      switch (safetyErrorType(failure)) {
        case "NotFound":
          setError(
            t`This can't be reported. It may have been deleted, or you can't see it any more.`,
          );
          break;
        case "CannotReportYourself":
          setError(t`You can't report yourself or your own content.`);
          break;
        case "TooManyReports":
          setError(
            t`You've sent a lot of reports today. Try again tomorrow, or choose an urgent reason if someone is in danger.`,
          );
          break;
        default:
          setError(describeError(failure));
      }
    } finally {
      setBusy(false);
    }
  }

  const title = () =>
    ({
      User: t`Report user`,
      Message: t`Report message`,
      Server: t`Report server`,
      Channel: t`Report channel`,
      Bot: t`Report bot`,
      Application: t`Report application`,
      CommunityItem: spec.effect ? t`Report this effect` : t`Report design`,
      Attachment: t`Report attachment`,
      Invite: t`Report invite`,
      Webhook: t`Report webhook`,
      DiscoverServer: t`Report Discover listing`,
      DiscoverBot: t`Report Discover listing`,
    })[spec.kind];

  const actions = () => {
    switch (step()) {
      case "reason":
        return [{ text: <Trans>Cancel</Trans>, variant: "secondary" as const }];
      case "sub":
        return [
          {
            text: <Trans>Back</Trans>,
            variant: "secondary" as const,
            onClick: () => (back(), false),
          },
          {
            text: <Trans>Skip</Trans>,
            variant: "text" as const,
            onClick: () => (setSub(undefined), setStep("details"), false),
          },
        ];
      case "details":
        return [
          {
            text: <Trans>Back</Trans>,
            variant: "secondary" as const,
            onClick: () => (back(), false),
          },
          {
            text: <Trans>Next</Trans>,
            variant: "primary" as const,
            isDisabled: !descriptionOk(),
            onClick: () => (setStep("review"), false),
          },
        ];
      case "review":
        return [
          {
            text: <Trans>Back</Trans>,
            variant: "secondary" as const,
            isDisabled: busy(),
            onClick: () => (back(), false),
          },
          {
            text: <Trans>Send report</Trans>,
            variant: "destructive" as const,
            isLoading: busy(),
            onClick: () => (void send(), false),
          },
        ];
      default:
        return [
          {
            text: <Trans>My reports</Trans>,
            variant: "secondary" as const,
            onClick: () => {
              openModal({
                type: "settings",
                config: "user",
                context: { page: "reports" },
              });
            },
          },
          { text: <Trans>Done</Trans>, variant: "primary" as const },
        ];
    }
  };

  const Target = () => (
    <TargetCard>
      <Show when={spec.image}>
        <img src={spec.image} alt="" />
      </Show>
      <span data-text>
        <small>{labels.kind[spec.kind]}</small>
        <Show
          when={spec.label}
          fallback={
            <strong>
              <bdi dir="ltr">{spec.id}</bdi>
            </strong>
          }
        >
          <p dir="auto">{spec.label}</p>
        </Show>
      </span>
    </TargetCard>
  );

  return (
    <Dialog
      tone="warning"
      iconName="flag"
      show={props.show}
      onClose={props.onClose}
      title={title()}
      size="md"
      showClose
      persistent={step() !== "reason" && step() !== "done"}
      error={error()}
      actions={actions()}
    >
      <Stack>
        <Switch>
          <Match when={step() === "reason"}>
            <Target />
            <p>
              <Trans>
                What's the problem? Your report goes to Zrzur's Trust & Safety
                team, not to the server's moderators, and the reported person
                won't know it was you.
              </Trans>
            </p>
            <Switch>
              <Match when={reasons.loading}>
                <Notice>
                  <Trans>Loading…</Trans>
                </Notice>
              </Match>
              <Match when={reasons.error}>
                <Notice data-tone="danger">
                  <Trans>The reasons couldn't be loaded.</Trans>{" "}
                  <button type="button" onClick={() => void refetch()}>
                    <Trans>Try again</Trans>
                  </button>
                </Notice>
              </Match>
              <Match when={reasons()}>
                <Choices role="list">
                  <For each={reasons()}>
                    {(entry) => (
                      <Choice
                        type="button"
                        role="listitem"
                        aria-pressed={category() === entry.category}
                        onClick={() => pick(entry)}
                      >
                        <span data-text>
                          <strong>
                            {labels.category[entry.category].name}
                          </strong>
                          <small>{labels.category[entry.category].hint}</small>
                        </span>
                        <Icon name="caret-right" size={18} />
                      </Choice>
                    )}
                  </For>
                </Choices>
              </Match>
            </Switch>
          </Match>

          <Match when={step() === "sub" && option()}>
            {(current) => (
              <>
                <p>
                  <strong>{labels.category[current().category].name}</strong>
                  {" · "}
                  <Trans>Which describes it best?</Trans>
                </p>
                <Choices role="list">
                  <For each={subcategories()}>
                    {(value) => (
                      <Choice
                        type="button"
                        role="listitem"
                        aria-pressed={sub() === value}
                        onClick={() => {
                          setSub(value);
                          setStep("details");
                        }}
                      >
                        <span data-text>
                          <strong>{labels.subcategory[value] ?? value}</strong>
                        </span>
                        <Icon name="caret-right" size={18} />
                      </Choice>
                    )}
                  </For>
                </Choices>
              </>
            )}
          </Match>

          <Match when={step() === "details"}>
            <Show when={category() === "SelfHarm"}>
              <Notice data-tone="danger">
                <Trans>
                  If someone is in immediate danger, contact your local
                  emergency services now.
                </Trans>
              </Notice>
            </Show>
            <Field>
              <span>
                {option()?.needs_description ? (
                  <Trans>What happened? (required)</Trans>
                ) : (
                  <Trans>Anything else we should know? (optional)</Trans>
                )}
              </span>
              <textarea
                dir="auto"
                maxLength={DESCRIPTION_MAX}
                value={description()}
                onInput={(event) => setDescription(event.currentTarget.value)}
                placeholder={t`Describe what happened. Don't paste private information you don't need to share.`}
              />
              <small>
                {description().length} / {DESCRIPTION_MAX}
              </small>
            </Field>
            <Notice>
              <Trans>
                We automatically include the reported content and, for messages,
                a few messages around it. You don't need to describe anything
                graphic.
              </Trans>
            </Notice>
          </Match>

          <Match when={step() === "review"}>
            <Target />
            <Summary>
              <dt>
                <Trans>Reason</Trans>
              </dt>
              <dd>
                {category() && labels.category[category()!].name}
                <Show when={sub()}>
                  {" · "}
                  {labels.subcategory[sub()!] ?? sub()}
                </Show>
              </dd>
              <Show when={description().trim()}>
                <dt>
                  <Trans>Details</Trans>
                </dt>
                <dd dir="auto">{description().trim()}</dd>
              </Show>
            </Summary>
            <Notice>
              <Trans>
                Reporting doesn't remove anything by itself. A reviewer checks
                the report against the Zrzur guidelines.
              </Trans>
            </Notice>
          </Match>

          <Match when={step() === "done" && receipt()}>
            {(done) => (
              <>
                <Notice>
                  <Show
                    when={done().existing}
                    fallback={
                      <Trans>
                        Thanks. Your report was sent to Zrzur Trust & Safety.
                      </Trans>
                    }
                  >
                    <Trans>
                      You already reported this. Your earlier report is still
                      being handled.
                    </Trans>
                  </Show>
                </Notice>
                <Summary>
                  <dt>
                    <Trans>Reference</Trans>
                  </dt>
                  <dd>
                    <bdi dir="ltr">{done().reference}</bdi>
                  </dd>
                  <dt>
                    <Trans>Status</Trans>
                  </dt>
                  <dd>{labels.receipt[done().status]}</dd>
                </Summary>
                <p>
                  <Trans>
                    You can follow it under Settings → Reports & standing.
                  </Trans>
                </p>
              </>
            )}
          </Match>
        </Switch>
      </Stack>
    </Dialog>
  );
}
