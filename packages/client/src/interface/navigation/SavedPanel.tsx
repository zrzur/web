import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import type { Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  type SavedEntry,
  fetchSaved,
  messageOf,
  unsaveMessage,
} from "@revolt/app/interface/saved/savedStore";
import { useClient } from "@revolt/client";
import { holdMessages } from "@revolt/client/messagePruner";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Button, CircularProgress, TextField, Time } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { EntryAction, InboxEntry, TitleRow } from "./InboxEntry";
import {
  type InboxPanelProps,
  Center,
  Head,
  List,
  Panel,
} from "./MentionsPanel";

const PAGE = 30;

/**
 * Saved messages: the private list of messages a person kept with "Save
 * message". Only they see it. It can be searched (words, file names, who
 * wrote it), an entry jumps to its message, and each one can be removed or
 * given a reminder.
 *
 * Saved messages                                   [x]
 * Only you see this list.
 * [ Search saved messages            ]
 * [avatar] Name            2d   [clock] [x]
 *          Server · #channel
 *          words of the message…
 * [ Show more ]
 */
export function SavedPanel(props: InboxPanelProps) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal, showError } = useModals();
  const app = useState();

  const [typed, setTyped] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [entries, setEntries] = createSignal<SavedEntry[]>([]);
  const [total, setTotal] = createSignal(0);
  const [state, setState] = createSignal<"loading" | "ready" | "error">(
    "loading",
  );
  const [more, setMore] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);

  // searching waits until the typing pauses
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(typed, (text) => {
      clearTimeout(timer);
      timer = setTimeout(() => setQuery(text.trim()), 250);
    }),
  );
  onCleanup(() => clearTimeout(timer));

  /** each load gets a number; an older, slower one never wins */
  let latest = 0;
  const load = async (append: boolean) => {
    const run = ++latest;
    const last = append ? entries().at(-1) : undefined;
    if (append) setLoadingMore(true);
    else setState("loading");
    try {
      const page = await fetchSaved(client(), {
        limit: PAGE,
        query: query() || undefined,
        before: last?.saved_at,
      });
      if (run !== latest) return;
      setEntries(append ? [...entries(), ...page.entries] : page.entries);
      setTotal(page.total);
      setMore(page.entries.length === PAGE);
      setState("ready");
    } catch {
      if (run !== latest) return;
      if (!append) setState("error");
    } finally {
      if (run === latest) setLoadingMore(false);
    }
  };
  createEffect(on(query, () => void load(false)));

  // these come from many channels: they stay in the message cache while
  // the list is open
  onCleanup(holdMessages(() => entries().map((entry) => entry.message)));

  const open = (message: Message) => {
    navigate(message.path);
    // phones: the lists and the conversation share the screen
    app.appDrawer()?.setShown(true);
    props.onNavigate?.();
  };

  const remove = async (entry: SavedEntry) => {
    try {
      await unsaveMessage(client(), entry.message);
      setEntries(entries().filter((item) => item.message !== entry.message));
      setTotal(Math.max(0, total() - 1));
    } catch (error) {
      showError(error);
    }
  };

  return (
    <Panel data-testid="saved-panel">
      <Head>
        <Show
          when={props.tabs}
          fallback={
            <TitleRow>
              <h2>
                <Trans>Saved messages</Trans>
              </h2>
              <Show when={props.onClose}>
                <EntryAction
                  icon="x"
                  label={t`Close`}
                  onPress={props.onClose!}
                />
              </Show>
            </TitleRow>
          }
        >
          {props.tabs}
        </Show>
        <p>
          <Trans>Only you see this list.</Trans>
        </p>
        <Search>
          <TextField
            type="search"
            variant="filled"
            value={typed()}
            aria-label={t`Search saved messages`}
            placeholder={t`Search saved messages`}
            data-testid="saved-search"
            onInput={(event) => setTyped(event.currentTarget.value)}
          />
        </Search>
      </Head>
      <List>
        <Switch>
          <Match when={state() === "loading"}>
            <Center>
              <CircularProgress />
            </Center>
          </Match>
          <Match when={state() === "error"}>
            <Center role="status">
              <Icon name="warning-circle" size={22} />
              <Trans>Saved messages couldn't load. Try again soon.</Trans>
            </Center>
          </Match>
          <Match when={!entries().length && query()}>
            <Center role="status">
              <Icon name="magnifying-glass" size={22} />
              <Trans>No saved message matches your search.</Trans>
            </Center>
          </Match>
          <Match when={!entries().length}>
            <Center role="status" data-testid="saved-empty">
              <Icon name="bookmark-simple" size={22} />
              <Trans>
                Nothing saved yet. Choose "Save message" in a message's menu to
                keep it here.
              </Trans>
            </Center>
          </Match>
          <Match when={entries().length}>
            <For each={entries()}>
              {(entry) => (
                <InboxEntry
                  testId="saved-entry"
                  message={messageOf(client(), entry)}
                  note={<Time format="relative" value={entry.saved_at} />}
                  onOpen={open}
                  actions={
                    <>
                      <Show when={messageOf(client(), entry)}>
                        {(message) => (
                          <EntryAction
                            icon="clock"
                            label={t`Remind me`}
                            testId="saved-remind"
                            onPress={() =>
                              openModal({
                                type: "remind_message",
                                message: message(),
                              })
                            }
                          />
                        )}
                      </Show>
                      <EntryAction
                        icon="x"
                        label={t`Remove from saved`}
                        testId="saved-remove"
                        onPress={() => void remove(entry)}
                      />
                    </>
                  }
                />
              )}
            </For>
            <Show when={more()}>
              <MoreRow>
                <Button
                  size="sm"
                  variant="tonal"
                  isDisabled={loadingMore()}
                  onPress={() => void load(true)}
                >
                  <Trans>Show more</Trans>
                </Button>
              </MoreRow>
            </Show>
          </Match>
        </Switch>
      </List>
    </Panel>
  );
}

const Search = styled("div", {
  base: { marginBlockStart: "12px" },
});

const MoreRow = styled("div", {
  base: {
    display: "flex",
    justifyContent: "center",
    flexShrink: 0,
    paddingBlock: "4px",
    _phone: { paddingBlock: "12px 4px" },
  },
});
