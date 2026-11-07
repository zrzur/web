import { For, Match, Switch, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import type { Server } from "@zrzur/sdk/solid";

import { useTime } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { Avatar, Button, SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Requests to join a private server. Approving makes the person a member;
 * the server checks the reviewer's permission and the applicant again.
 */
export function JoinRequests(props: { server: Server }) {
  const queryClient = useQueryClient();
  const { showError } = useModals();
  const dayjs = useTime();
  const [busy, setBusy] = createSignal<string>();

  const key = () => ["join_requests", props.server.id];
  const query = useQuery(() => ({
    queryKey: key(),
    queryFn: () => props.server.fetchJoinRequests(),
  }));

  async function decide(userId: string, approve: boolean) {
    if (busy()) return;
    setBusy(userId);
    try {
      if (approve) await props.server.approveJoinRequest(userId);
      else await props.server.rejectJoinRequest(userId);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(undefined);
      // a decision someone else made first also disappears from the list
      queryClient.invalidateQueries({ queryKey: key() });
    }
  }

  return (
    <SettingsSection
      description={
        <Trans>
          People who asked to join this private server. They can't see anything
          inside until you approve them.
        </Trans>
      }
    >
      <Switch>
        <Match when={query.isLoading}>
          <SettingsRow
            icon={<Icon name="user-plus" size={20} />}
            title={<Trans>Loading requests…</Trans>}
          />
        </Match>
        <Match when={query.isError}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            danger
            title={<Trans>Requests couldn't be loaded</Trans>}
          />
        </Match>
        <Match when={!query.data?.length}>
          <SettingsRow
            icon={<Icon name="users" size={20} />}
            title={<Trans>No requests waiting</Trans>}
            description={
              <Trans>
                When someone opens a join link to this server, their request
                shows up here.
              </Trans>
            }
          />
        </Match>
        <Match when={query.data}>
          <For each={query.data}>
            {(item) => (
              <SettingsRow
                icon={
                  <Avatar
                    src={item.user?.avatar?.previewUrl}
                    fallback={item.user?.username}
                    size={32}
                  />
                }
                title={item.user?.username ?? item.request.user}
                description={
                  <Trans>
                    Asked {dayjs(item.request.created_at).fromNow()}
                  </Trans>
                }
                control={() => (
                  <>
                    <Button
                      size="sm"
                      variant="text"
                      isDisabled={!!busy()}
                      onPress={() => decide(item.request.user, false)}
                    >
                      <Trans>Reject</Trans>
                    </Button>
                    <Button
                      size="sm"
                      isDisabled={!!busy()}
                      onPress={() => decide(item.request.user, true)}
                    >
                      <Trans>Approve</Trans>
                    </Button>
                  </>
                )}
              />
            )}
          </For>
        </Match>
      </Switch>
    </SettingsSection>
  );
}
