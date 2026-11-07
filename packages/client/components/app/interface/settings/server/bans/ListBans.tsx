import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { Server, ServerBan } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  Avatar,
  Button,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { ConfirmDialog } from "../ConfirmDialog";

/**
 * List and invalidate server bans
 */
export function ListServerBans(props: { server: Server }) {
  const { t } = useLingui();
  const client = useQueryClient();

  const query = useQuery(() => ({
    queryKey: ["bans", props.server.id],
    queryFn: () => props.server.fetchBans() as Promise<ServerBan[]>,
  }));

  const [unbanning, setUnbanning] = createSignal<ServerBan>();

  async function pardon(ban: ServerBan) {
    await ban.pardon();
    client.setQueryData(
      ["bans", props.server.id],
      query.data!.filter((entry) => entry.id.user !== ban.id.user),
    );
  }

  const [filter, setFilter] = createSignal("");

  // one search over name and reason
  const data = createMemo(() => {
    const q = filter().trim().toLowerCase();
    if (!query.data || !q) return query.data;
    return query.data.filter(
      (entry) =>
        (entry.user?.username ?? "").toLowerCase().includes(q) ||
        (entry.reason ?? "").toLowerCase().includes(q),
    );
  });

  return (
    <SettingsSection
      title={<Trans>Banned members</Trans>}
      description={
        <Trans>
          Banned people can't rejoin until they're unbanned, even with an
          invite.
        </Trans>
      }
    >
      <Search>
        <TextField
          type="search"
          aria-label={t`Search bans`}
          placeholder={t`Search by name or reason`}
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
      </Search>
      <Switch>
        <Match when={query.isLoading}>
          <SettingsRow
            icon={<Icon name="gavel" size={20} />}
            title={<Trans>Loading bans…</Trans>}
          />
        </Match>
        <Match when={query.isError}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            danger
            title={<Trans>Bans couldn't be loaded</Trans>}
          />
        </Match>
        <Match when={!query.data?.length}>
          <SettingsRow
            icon={<Icon name="gavel" size={20} />}
            title={<Trans>No one is banned</Trans>}
            description={
              <Trans>People you ban from the member list show up here.</Trans>
            }
          />
        </Match>
        <Match when={!data()?.length}>
          <SettingsRow
            icon={<Icon name="magnifying-glass" size={20} />}
            title={<Trans>No ban matches that search</Trans>}
          />
        </Match>
        <Match when={data()}>
          <For each={data()}>
            {(item) => (
              <SettingsRow
                icon={
                  <Avatar
                    src={item.user?.avatar?.previewUrl}
                    fallback={item.user?.username}
                    size={32}
                  />
                }
                title={
                  <>
                    {item.user?.username}
                    <Tag>#{item.user?.discriminator}</Tag>
                  </>
                }
                description={item.reason || t`No reason given`}
                control={() => (
                  <Button
                    size="sm"
                    variant="tonal"
                    shape="square"
                    onPress={() => setUnbanning(item)}
                  >
                    <Trans>Unban</Trans>
                  </Button>
                )}
              />
            )}
          </For>
        </Match>
      </Switch>
      <Show when={unbanning()}>
        {(ban) => (
          <ConfirmDialog
            title={<Trans>Lift this ban?</Trans>}
            confirm={<Trans>Unban</Trans>}
            onConfirm={() => pardon(ban())}
            onClose={() => setUnbanning(undefined)}
          >
            <Trans>
              {ban().user?.username ?? ""} can join the server again.
            </Trans>
          </ConfirmDialog>
        )}
      </Show>
    </SettingsSection>
  );
}

const Search = styled("div", {
  base: {
    padding: "12px 12px 4px",
  },
});

const Tag = styled("span", {
  base: {
    marginInlineStart: "2px",
    color: "var(--z-fg-muted)",
    fontWeight: 400,
  },
});
