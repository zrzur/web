import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import type { Message } from "@zrzur/sdk/solid";

import {
  cancelSelection,
  pickRecent,
  splitByAge,
} from "@revolt/app/interface/channels/text/messageSelection";
import { TranslatedError } from "@revolt/i18n/errors";
import {
  Column,
  Dialog,
  DialogProps,
  FloatingSelect,
  MenuItem,
  Text,
} from "@revolt/ui";

import { Modals } from "../types";

/** How many recent messages a moderator can pick */
const RECENT_COUNTS = [10, 50, 100] as const;

/**
 * Delete many messages at once (needs Manage Messages): the selected ones,
 * or the most recent ones, optionally from one member. The server takes
 * at most 100 messages from the last 7 days in one request.
 */
export function BulkDeleteMessagesModal(
  props: DialogProps & Modals & { type: "bulk_delete_messages" },
) {
  const { t } = useLingui();
  const [error, setError] = createSignal<unknown>();
  const [pending, setPending] = createSignal(false);
  const [count, setCount] = createSignal<number>(RECENT_COUNTS[0]);
  const [author, setAuthor] = createSignal<string>("");

  // "recent": the newest 100 messages of the channel, fetched once
  const [recent] = createResource(
    () => (props.ids ? undefined : props.channel.id),
    () => props.channel.fetchMessages({ limit: 100 }),
  );

  /** People who wrote one of the recent messages */
  const authors = createMemo(() => {
    const seen = new Map<string, string>();
    for (const message of recent() ?? []) {
      if (!message.authorId || seen.has(message.authorId)) continue;
      seen.set(message.authorId, displayName(message));
    }
    return [...seen.entries()];
  });

  /** Ids the request will carry, and those left out for their age */
  const plan = createMemo(() => {
    if (props.ids) {
      const { deletable, tooOld } = splitByAge(props.ids);
      return { ids: deletable, tooOld: tooOld.length };
    }
    const messages = (recent() ?? []).map((message) => ({
      id: message.id,
      authorId: message.authorId,
    }));
    return {
      ids: pickRecent(messages, count(), author() || undefined),
      tooOld: 0,
    };
  });

  async function remove() {
    const ids = plan().ids;
    if (!ids.length) throw new Error("nothing to delete");
    setPending(true);
    setError(undefined);
    try {
      await props.channel.deleteMessages(ids);
      cancelSelection();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      tone="danger"
      iconName="trash"
      show={props.show}
      onClose={props.onClose}
      title={
        props.ids ? (
          <Trans>Delete selected messages</Trans>
        ) : (
          <Trans>Delete recent messages</Trans>
        )
      }
      size="sm"
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: (
            <Plural
              value={plan().ids.length}
              one="Delete # message"
              other="Delete # messages"
            />
          ),
          variant: "destructive",
          onClick: remove,
          isDisabled: !plan().ids.length || recent.loading,
          isLoading: pending(),
        },
      ]}
      isDisabled={pending()}
    >
      <Column gap="lg" data-testid="bulk-delete-dialog">
        <Show when={!props.ids}>
          <FloatingSelect
            label={t`How many`}
            value={String(count())}
            onChange={(e) => setCount(Number(e.currentTarget.value))}
          >
            <For each={RECENT_COUNTS}>
              {(value) => (
                <MenuItem value={String(value)}>
                  <Plural
                    value={value}
                    one="Last # message"
                    other="Last # messages"
                  />
                </MenuItem>
              )}
            </For>
          </FloatingSelect>
          <FloatingSelect
            label={t`From`}
            value={author()}
            onChange={(e) => setAuthor(e.currentTarget.value)}
          >
            <MenuItem value="">{t`Anyone`}</MenuItem>
            <For each={authors()}>
              {([id, name]) => <MenuItem value={id}>{name}</MenuItem>}
            </For>
          </FloatingSelect>
        </Show>

        <Text>
          <Show
            when={!recent.loading}
            fallback={<Trans>Looking for messages…</Trans>}
          >
            <Show
              when={plan().ids.length}
              fallback={
                <Trans>
                  There is nothing to delete: only messages from the last 7 days
                  can be deleted together.
                </Trans>
              }
            >
              <Plural
                value={plan().ids.length}
                one="# message will be deleted for everyone. This cannot be undone."
                other="# messages will be deleted for everyone. This cannot be undone."
              />
            </Show>
          </Show>
        </Text>

        <Show when={plan().tooOld}>
          <Text class="label" size="small">
            <Plural
              value={plan().tooOld}
              one="# message is older than 7 days and stays; delete it on its own."
              other="# messages are older than 7 days and stay; delete them one by one."
            />
          </Text>
        </Show>

        <Show when={error()}>
          <div role="alert">
            <TranslatedError error={error()} />
          </div>
        </Show>
      </Column>
    </Dialog>
  );
}

function displayName(message: Message) {
  return (
    message.member?.nickname ??
    message.author?.displayName ??
    message.author?.username ??
    message.username ??
    message.authorId ??
    ""
  );
}
