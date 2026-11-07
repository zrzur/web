import { Component, Match, Show, Switch, createMemo } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Navigate, useNavigate, useParams } from "@revolt/routing";
import { Button, EmptyState } from "@revolt/ui";

/**
 * Server home component
 */
export const ServerHome: Component = () => {
  const params = useParams();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const server = createMemo(() => client()!.servers.get(params.server));

  return (
    <Switch
      fallback={
        <EmptyState
          art="chats"
          title={<Trans>This server has no channels yet</Trans>}
          description={
            <Show
              when={server()?.havePermission("ManageChannel")}
              fallback={
                <Trans>
                  Channels you can see will show up here once they are added.
                </Trans>
              }
            >
              <Trans>Create a channel so members have a place to talk.</Trans>
            </Show>
          }
          action={
            <Show when={server()?.havePermission("ManageChannel")}>
              <Button
                onPress={() =>
                  openModal({
                    type: "create_channel",
                    server: server()!,
                    cb: (channel) =>
                      navigate(`/server/${server()!.id}/channel/${channel.id}`),
                  })
                }
              >
                <Trans>Create channel</Trans>
              </Button>
            </Show>
          }
        />
      }
    >
      <Match when={!server()}>
        <Navigate href={"/"} />
      </Match>
      {/* a server with a lobby opens on it */}
      <Match when={server()!.lobby?.enabled}>
        <Navigate href="lobby" />
      </Match>
      <Match when={server()!.defaultChannel}>
        <Navigate href={`channel/${server()!.defaultChannel!.id}`} />
      </Match>
    </Switch>
  );
};
