import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  type ReminderPreset,
  dueProblem,
  presetTimes,
  suggestedCustomTime,
} from "@revolt/app/interface/saved/savedModel";
import {
  createReminder,
  moveReminder,
  remindersChanged,
} from "@revolt/app/interface/saved/savedStore";
import { useClient } from "@revolt/client";
import { timeLocale, useTime } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { DateTimeField, Dialog, DialogProps, useSnackbar } from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

/**
 * "Remind me" on a message: four ready-made times and one the person picks.
 * Times are on the person's own clock; the reminder comes back as a notice
 * in the app, a notification, and an entry under Reminders.
 *
 * Remind me
 * "words of the message…"
 * [ In 20 minutes              14:30 ]
 * [ In 1 hour                  15:10 ]
 * [ Tonight                    20:00 ]
 * [ Tomorrow morning   Fri 09:00     ]
 * [ Pick a time                    v ]
 *                 [Cancel] [Set reminder]
 */
export function RemindMessageModal(
  props: DialogProps & Modals & { type: "remind_message" },
) {
  const { t } = useLingui();
  const client = useClient();
  const dayjs = useTime();
  const snackbar = useSnackbar();

  const now = new Date();
  const presets = presetTimes(now);
  const [custom, setCustom] = createSignal(!!props.reminder);
  const [at, setAt] = createSignal<Date>(
    props.reminder ? new Date(props.reminder.due_at) : suggestedCustomTime(now),
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  const [problem, setProblem] = createSignal<string>();

  const hour12 = () => hour12From(timeLocale()[1].formats?.LT);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const names: Record<ReminderPreset, () => string> = {
    "20m": () => t`In 20 minutes`,
    "1h": () => t`In 1 hour`,
    tonight: () => t`Tonight`,
    morning: () => t`Tomorrow morning`,
  };
  /** the hour for today's times, the day as well for another day's */
  const shown = (time: Date) =>
    time.toDateString() === now.toDateString()
      ? dayjs(time).format("LT")
      : dayjs(time).format("ddd LT");

  const set = async (time: Date) => {
    if (busy()) throw new Error("busy");
    const wrong = dueProblem(time, new Date());
    if (wrong) {
      setProblem(
        wrong === "past"
          ? t`Pick a time that is still ahead.`
          : t`Pick a time within the next year.`,
      );
      throw new Error(wrong);
    }
    setProblem(undefined);
    setError(undefined);
    setBusy(true);
    try {
      if (props.reminder)
        await moveReminder(client(), props.reminder._id, time);
      else await createReminder(client(), props.message.id, time);
      remindersChanged();
      snackbar.show({
        message: t`Reminder set for ${dayjs(time).calendar()}.`,
      });
    } catch (failure) {
      setError(failure);
      throw failure;
    } finally {
      setBusy(false);
    }
  };

  const choose = (time: Date) =>
    void set(time)
      .then(() => props.onClose())
      .catch(() => {});

  const words = () =>
    client()
      .markdownToText(props.message.content ?? "")
      .slice(0, 140);

  return (
    <Dialog
      tone="info"
      iconName="clock"
      show={props.show}
      onClose={props.onClose}
      title={
        props.reminder ? (
          <Trans>Change the time</Trans>
        ) : (
          <Trans>Remind me</Trans>
        )
      }
      error={
        error() ? <TranslatedError error={error()} /> : (problem() ?? undefined)
      }
      actions={[
        { text: <Trans>Cancel</Trans> },
        ...(custom()
          ? [
              {
                text: props.reminder ? (
                  <Trans>Save</Trans>
                ) : (
                  <Trans>Set reminder</Trans>
                ),
                onClick: () => set(at()),
                isLoading: busy(),
              },
            ]
          : []),
      ]}
      isDisabled={busy()}
    >
      <Fields data-testid="remind-dialog">
        <Show when={words()}>
          <Quote>
            <bdi>{words()}</bdi>
          </Quote>
        </Show>
        <Choices role="group" aria-label={t`When`}>
          <For each={presets}>
            {(item) => (
              <Choice
                type="button"
                data-preset={item.preset}
                disabled={busy()}
                onClick={() => choose(item.at)}
              >
                <span>
                  {item.preset === "morning" && item.sameDay
                    ? t`This morning`
                    : names[item.preset]()}
                </span>
                <time datetime={item.at.toISOString()}>{shown(item.at)}</time>
              </Choice>
            )}
          </For>
          <Choice
            type="button"
            data-preset="custom"
            aria-expanded={custom()}
            disabled={busy()}
            onClick={() => setCustom(!custom())}
          >
            <span>
              <Trans>Pick a time</Trans>
            </span>
            <Icon name={custom() ? "caret-up" : "caret-down"} size={16} />
          </Choice>
        </Choices>
        <Show when={custom()}>
          <DateTimeField
            label={t`Remind me at`}
            value={at()}
            min={new Date()}
            hour12={hour12()}
            helper={t`Your time zone: ${zone}`}
            testId="remind-custom"
            onChange={(value) => {
              setAt(value);
              setProblem(undefined);
            }}
          />
        </Show>
      </Fields>
    </Dialog>
  );
}

const Fields = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const Quote = styled("p", {
  base: {
    margin: 0,
    paddingInlineStart: "12px",
    borderInlineStart: "2px solid var(--z-border-strong)",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    lineClamp: 2,
    overflowWrap: "anywhere",
  },
});

const Choices = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const Choice = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    minHeight: "44px",
    padding: "8px 12px",
    border: "1px solid var(--z-card-border, var(--z-border-soft))",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-card-bg)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "15px",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-neutral)",
    "& time": {
      flexShrink: 0,
      fontSize: "13px",
      color: "var(--z-fg-muted)",
    },
    _hover: { background: "var(--z-nav-hover)" },
    _active: { background: "var(--z-nav-selected)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _disabled: { opacity: 0.6, cursor: "default" },
  },
});
