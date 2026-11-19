import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import type { Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  canAddReminder,
  splitReminders,
} from "@revolt/app/interface/saved/savedModel";
import {
  type Reminder,
  type RemindersAnswer,
  fetchReminders,
  messageOf,
  reminderChanges,
  removeReminder,
} from "@revolt/app/interface/saved/savedStore";
import { useClient } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { holdMessages } from "@revolt/client/messagePruner";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Button, CircularProgress, Time } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { EntryAction, InboxEntry, Section, TitleRow } from "./InboxEntry";
import {
  type InboxPanelProps,
  Center,
  Head,
  List,
  Panel,
} from "./MentionsPanel";

/**
 * Reminders: the messages a person asked to be reminded of. The ones whose
 * time has come are on top until they are cleared; the waiting ones follow,
 * soonest first, each with its time, a way to change it and a way to cancel.
 *
 * Reminders                                        [x]
 * 3 of 10 waiting.            [ More with Feather ]
 * Due
 * [avatar] Name      1h ago            [check]
 * Waiting
 * [avatar] Name      Tomorrow 09:00    [pencil] [x]
 */
export function RemindersPanel(props: InboxPanelProps) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal, showError } = useModals();
  const app = useState();

  const [answer, setAnswer] = createSignal<RemindersAnswer>();
  const [failed, setFailed] = createSignal(false);

  let latest = 0;
  const load = async () => {
    const run = ++latest;
    try {
      const next = await fetchReminders(client());
      if (run !== latest) return;
      setAnswer(next);
      setFailed(false);
    } catch {
      if (run === latest && !answer()) setFailed(true);
    }
  };
  // again whenever a reminder is set, moved, removed or comes due
  createEffect(on(reminderChanges, () => void load()));

  const lists = createMemo(() => splitReminders(answer()?.reminders ?? []));

  // these come from many channels: they stay in the message cache while
  // the list is open
  onCleanup(
    holdMessages(() => (answer()?.reminders ?? []).map((r) => r.message)),
  );

  const open = (message: Message) => {
    navigate(message.path);
    // phones: the lists and the conversation share the screen
    app.appDrawer()?.setShown(true);
    props.onNavigate?.();
  };

  const remove = async (reminder: Reminder) => {
    try {
      await removeReminder(client(), reminder._id);
      const current = answer();
      if (current)
        setAnswer({
          ...current,
          reminders: current.reminders.filter(
            (item) => item._id !== reminder._id,
          ),
        });
    } catch (error) {
      showError(error);
    }
  };

  const full = () =>
    !canAddReminder(lists().waiting.length, answer()?.max_active);
  /** Feather would raise the limit, and can be had here */
  const featherHelps = () =>
    billingAvailable() &&
    !!answer() &&
    answer()!.max_active < answer()!.max_active_plus;

  return (
    <Panel data-testid="reminders-panel">
      {props.tabs}
      <Head>
        <TitleRow>
          <h2>
            <Trans>Reminders</Trans>
          </h2>
          <Show when={props.onClose}>
            <EntryAction icon="x" label={t`Close`} onPress={props.onClose!} />
          </Show>
        </TitleRow>
        <Show
          when={answer()}
          fallback={
            <p>
              <Trans>Messages you asked to be reminded of.</Trans>
            </p>
          }
        >
          <Limit>
            <p data-testid="reminders-count" data-full={full() || undefined}>
              <Trans>
                {lists().waiting.length} of {answer()!.max_active} waiting.
              </Trans>
            </p>
            <Show when={featherHelps()}>
              <Button
                size="xs"
                variant="text"
                data-testid="reminders-feather"
                onPress={() => {
                  props.onNavigate?.();
                  openModal({
                    type: "settings",
                    config: "user",
                    context: { page: "plus" },
                  });
                }}
              >
                <Trans>Up to {answer()!.max_active_plus} with Feather</Trans>
              </Button>
            </Show>
          </Limit>
        </Show>
      </Head>
      <List>
        <Switch>
          <Match when={failed()}>
            <Center role="status">
              <Icon name="warning-circle" size={22} />
              <Trans>Reminders couldn't load. Try again soon.</Trans>
            </Center>
          </Match>
          <Match when={!answer()}>
            <Center>
              <CircularProgress />
            </Center>
          </Match>
          <Match when={!answer()!.reminders.length}>
            <Center role="status" data-testid="reminders-empty">
              <Icon name="clock" size={22} />
              <Trans>
                No reminders. Choose "Remind me" in a message's menu and it
                comes back to you at the time you pick.
              </Trans>
            </Center>
          </Match>
          <Match when={answer()}>
            <Show when={lists().due.length}>
              <Section>
                <Trans>Due</Trans>
              </Section>
              <For each={lists().due}>
                {(reminder) => (
                  <InboxEntry
                    testId="reminder-due"
                    message={messageOf(client(), reminder)}
                    note={
                      <Time format="relative" value={reminder.delivered_at!} />
                    }
                    onOpen={open}
                    actions={
                      <EntryAction
                        icon="check"
                        label={t`Done, clear it`}
                        testId="reminder-clear"
                        onPress={() => void remove(reminder)}
                      />
                    }
                  />
                )}
              </For>
            </Show>
            <Show when={lists().waiting.length}>
              <Section>
                <Trans>Upcoming</Trans>
              </Section>
              <For each={lists().waiting}>
                {(reminder) => (
                  <InboxEntry
                    testId="reminder-waiting"
                    message={messageOf(client(), reminder)}
                    note={<Time format="calendar" value={reminder.due_at} />}
                    onOpen={open}
                    actions={
                      <>
                        <Show when={messageOf(client(), reminder)}>
                          {(message) => (
                            <EntryAction
                              icon="pencil-simple"
                              label={t`Change the time`}
                              testId="reminder-move"
                              onPress={() =>
                                openModal({
                                  type: "remind_message",
                                  message: message(),
                                  reminder,
                                })
                              }
                            />
                          )}
                        </Show>
                        <EntryAction
                          icon="x"
                          label={t`Cancel reminder`}
                          testId="reminder-cancel"
                          onPress={() => void remove(reminder)}
                        />
                      </>
                    }
                  />
                )}
              </For>
            </Show>
          </Match>
        </Switch>
      </List>
    </Panel>
  );
}

const Limit = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "4px 12px",
    "& p[data-full]": {
      color: "var(--z-status-warning, var(--z-fg-secondary))",
    },
  },
});
