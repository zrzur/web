import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server, User } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import {
  Avatar,
  Button,
  Column,
  Dialog,
  SettingsRow,
  SettingsSection,
  Text,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { canTransferTo, confirmsName } from "./ownership";

/**
 * The two decisions only the owner makes: give the server to someone
 * else, or delete it. The server checks both (server_edit.rs: only the
 * owner can change `owner`, never to a bot; server_delete.rs).
 */
export function ServerOwnership(props: { server: Server }) {
  const { t } = useLingui();
  const describeError = useError();
  const { mfaFlow } = useModals();
  const client = useClient();

  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<User[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [chosen, setChosen] = createSignal<User>();
  const [typed, setTyped] = createSignal("");
  const [error, setError] = createSignal<string>();
  const [deleting, setDeleting] = createSignal(false);
  const [deleteTyped, setDeleteTyped] = createSignal("");
  const [deleteError, setDeleteError] = createSignal<string>();

  const isOwner = () => !!props.server.owner?.self;

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  function search(value: string) {
    setQuery(value);
    clearTimeout(searchTimer);
    if (value.trim().length < 2) return setResults([]);
    searchTimer = setTimeout(async () => {
      setSearching(true);
      try {
        const { users } = await props.server.queryMembersExperimental(
          value.trim(),
        );
        setResults(
          users.filter((user) => canTransferTo(user, props.server)).slice(0, 8),
        );
      } catch (err) {
        setError(describeError(err));
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  function reset() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setChosen(undefined);
    setTyped("");
  }

  function resetDelete() {
    setDeleting(false);
    setDeleteTyped("");
    setDeleteError(undefined);
  }

  async function remove() {
    if (!confirmsName(deleteTyped(), props.server.name))
      throw new Error("name");
    setDeleteError(undefined);
    try {
      // the server asks for the password or a 2FA code first
      const ticket = await mfaFlow(await client().account.mfa());
      // cancelling that step leaves the question open
      if (!ticket) throw new Error("cancelled");
      await props.server.delete(undefined, ticket);
    } catch (err) {
      if ((err as Error)?.message !== "cancelled")
        setDeleteError(describeError(err));
      throw err;
    }
  }

  async function transfer() {
    const user = chosen();
    if (!user || !confirmsName(typed(), props.server.name))
      throw new Error("name");
    setError(undefined);
    try {
      // the server asks for the password or a 2FA code first
      const ticket = await mfaFlow(await client().account.mfa());
      // cancelling that step leaves the question open
      if (!ticket) throw new Error("cancelled");
      await props.server.transferOwnership(user.id, ticket);
    } catch (err) {
      if ((err as Error)?.message !== "cancelled")
        setError(describeError(err));
      throw err;
    }
  }

  return (
    <Column gap="xl">
      <SettingsSection title={<Trans>Owner</Trans>}>
        <SettingsRow
          icon={<Icon name="crown" size={20} />}
          title={<Trans>Transfer ownership</Trans>}
          description={
            <Trans>Give the server to a member. You stay a member.</Trans>
          }
          control={() => (
            <Button
              size="sm"
              variant="tonal"
              isDisabled={!isOwner()}
              onPress={() => setOpen(true)}
            >
              <Trans>Transfer</Trans>
            </Button>
          )}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Delete</Trans>}>
        <SettingsRow
          danger
          icon={<Icon name="trash" size={20} />}
          title={<Trans>Delete server</Trans>}
          description={
            <Trans>
              Removes every channel and message. It can't be undone.
            </Trans>
          }
          control={() => (
            <Button
              size="sm"
              variant="error"
              isDisabled={!isOwner()}
              onPress={() => setDeleting(true)}
            >
              <Trans>Delete</Trans>
            </Button>
          )}
        />
      </SettingsSection>

      <Show when={deleting()}>
        <Dialog
          show
          tone="danger"
          size="sm"
          onClose={resetDelete}
          title={<Trans>Delete {props.server.name}?</Trans>}
          actions={[
            { text: <Trans>Cancel</Trans> },
            {
              text: <Trans>Delete server</Trans>,
              variant: "destructive",
              isDisabled: !confirmsName(deleteTyped(), props.server.name),
              onClick: remove,
            },
          ]}
        >
          <Column gap="md">
            <Text>
              <Trans>
                Every channel and message is removed and it can't be undone.
                Type the server name to confirm. If you use two-step sign-in,
                you will be asked for your code next.
              </Trans>
            </Text>
            <TextField
              label={t`Server name`}
              placeholder={props.server.name}
              value={deleteTyped()}
              error={deleteError()}
              onInput={(e) => {
                setDeleteTyped(e.currentTarget.value);
                setDeleteError(undefined);
              }}
            />
          </Column>
        </Dialog>
      </Show>

      <Show when={open()}>
        <Dialog
          show
          tone="danger"
          size="sm"
          onClose={reset}
          title={<Trans>Transfer ownership</Trans>}
          actions={[
            { text: <Trans>Cancel</Trans> },
            {
              text: <Trans>Transfer</Trans>,
              isDisabled:
                !chosen() || !confirmsName(typed(), props.server.name),
              onClick: transfer,
            },
          ]}
        >
          <Column gap="md">
            <Show
              when={chosen()}
              fallback={
                <>
                  <TextField
                    label={t`Member`}
                    placeholder={t`Type a name`}
                    value={query()}
                    onInput={(e) => search(e.currentTarget.value)}
                  />
                  <Show when={searching()}>
                    <Text size="small">
                      <Trans>Searching…</Trans>
                    </Text>
                  </Show>
                  <For each={results()}>
                    {(user) => (
                      <SettingsRow
                        navigational
                        icon={<Avatar src={user.animatedAvatarURL} size={24} />}
                        title={user.displayName}
                        description={`@${user.username}`}
                        onClick={() => setChosen(user)}
                      />
                    )}
                  </For>
                </>
              }
            >
              {(user) => (
                <>
                  <Text>
                    <Trans>
                      {user().displayName} becomes the owner and can remove you.
                      Type the server name to confirm.
                    </Trans>
                  </Text>
                  <TextField
                    label={t`Server name`}
                    placeholder={props.server.name}
                    value={typed()}
                    error={error()}
                    onInput={(e) => {
                      setTyped(e.currentTarget.value);
                      setError(undefined);
                    }}
                  />
                </>
              )}
            </Show>
          </Column>
        </Dialog>
      </Show>
    </Column>
  );
}
