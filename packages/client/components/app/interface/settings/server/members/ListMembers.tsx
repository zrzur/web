import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/solid/macro";
import { useInfiniteQuery, useQuery } from "@tanstack/solid-query";
import { Server, ServerMember } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime } from "ulid";

import { UserContextMenu } from "@revolt/app/menus/UserContextMenu";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import {
  Avatar,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { Icon } from "@revolt/ui/icons/Icon";

import { fetchMemberPage } from "./fetchMemberPage";
import { mergeMembers, needsServerSearch } from "./memberPages";

type Sort = "newest" | "oldest" | "name";

/** How many rows show before "Show more" */
const PAGE = 50;

/**
 * Everyone in the server: who they are, when they came, their roles, and
 * every moderation action from one place
 */
export function ListServerMembers(props: { server: Server }) {
  const { t } = useLingui();
  const { openModal, showError } = useModals();
  const client = useClient();

  // a page of 1000 at a time, more as the list is scrolled through
  const query = useInfiniteQuery(() => ({
    queryKey: ["members", props.server.id],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchMemberPage(client(), props.server, {
        limit: 1000,
        after: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: { next?: string }) => last.next,
  }));

  const [search, setSearch] = createSignal("");
  const [term, setTerm] = createSignal("");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  // members not loaded yet are found by asking the server
  const found = useQuery(() => ({
    queryKey: ["members-search", props.server.id, term()],
    queryFn: async () =>
      (await props.server.queryMembersExperimental(term())).members,
    enabled: needsServerSearch(term(), !!query.hasNextPage),
  }));

  const loaded = () =>
    mergeMembers(
      query.data?.pages.map((page) => page.members) ?? [],
      search().trim() ? (found.data ?? []) : [],
    );
  const [role, setRole] = createSignal("");
  const [sort, setSort] = createSignal<Sort>("newest");
  const [shown, setShown] = createSignal(PAGE);

  const canManageRoles = () => props.server.havePermission("AssignRoles");
  /**
   * As the API decides: the owner changes anyone's roles; with Assign roles
   * you change your own and those of members below your highest role
   */
  const canEditMember = (member: ServerMember) =>
    !!props.server.owner?.self ||
    (canManageRoles() &&
      member.id.user !== props.server.ownerId &&
      (!!member.user?.self || member.inferiorTo(props.server.member!)));
  const date = (value: Date) =>
    new Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(value);

  const members = createMemo(() => {
    const q = search().trim().toLowerCase();
    const list = loaded().filter((member) => {
      if (role() && !member.roles.includes(role())) return false;
      if (!q) return true;
      return [member.displayName, member.user?.username, member.id.user]
        .filter(Boolean)
        .some((text) => text!.toLowerCase().includes(q));
    });
    const name = (m: ServerMember) =>
      (m.displayName ?? m.user?.username ?? "").toLowerCase();
    return list.sort((a, b) =>
      sort() === "name"
        ? name(a).localeCompare(name(b))
        : sort() === "oldest"
          ? +a.joinedAt - +b.joinedAt
          : +b.joinedAt - +a.joinedAt,
    );
  });

  async function removeRole(member: ServerMember, roleId: string) {
    try {
      await member.edit({ roles: member.roles.filter((id) => id !== roleId) });
    } catch (error) {
      showError(error);
    }
  }

  return (
    <SettingsSection
      title={
        <Trans>
          {Math.max(props.server.approximateMemberCount, loaded().length)} in
          total
        </Trans>
      }
    >
      <Toolbar>
        <TextField
          type="search"
          aria-label={t`Search members`}
          placeholder={t`Search by name or ID`}
          value={search()}
          onInput={(e) => {
            const value = e.currentTarget.value;
            setSearch(value);
            setShown(PAGE);
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => setTerm(value.trim()), 300);
          }}
        />
        <Filter>
          <FloatingSelect
            aria-label={t`Filter by role`}
            value={role() || "all"}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setRole(value === "all" ? "" : value);
              setShown(PAGE);
            }}
          >
            <MenuItem value="all">{t`All roles`}</MenuItem>
            <For each={props.server.orderedRoles}>
              {(item) => <MenuItem value={item.id}>{item.name}</MenuItem>}
            </For>
          </FloatingSelect>
        </Filter>
        <Filter>
          <FloatingSelect
            aria-label={t`Sort members`}
            value={sort()}
            onChange={(e) => {
              const value = e.currentTarget.value as Sort;
              if (value) setSort(value);
            }}
          >
            <MenuItem value="newest">{t`Newest first`}</MenuItem>
            <MenuItem value="oldest">{t`Oldest first`}</MenuItem>
            <MenuItem value="name">{t`Name A–Z`}</MenuItem>
          </FloatingSelect>
        </Filter>
      </Toolbar>

      <Switch>
        <Match when={query.isLoading}>
          <SettingsRow
            icon={<Icon name="users" size={20} />}
            title={<Trans>Loading members…</Trans>}
          />
        </Match>
        <Match when={query.isError}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            danger
            title={<Trans>Members couldn't be loaded</Trans>}
          />
        </Match>
        <Match when={!members().length}>
          <SettingsRow
            icon={<Icon name="magnifying-glass" size={20} />}
            title={<Trans>No member matches</Trans>}
          />
        </Match>
        <Match when={true}>
          <Head aria-hidden="true">
            <span>{t`Name`}</span>
            <span>{t`Member since`}</span>
            <span>{t`Joined Zrzur`}</span>
            <span>{t`Roles`}</span>
            <span />
          </Head>
          <For each={members().slice(0, shown())}>
            {(member) => {
              const user = () => member.user;
              const timedOut = () =>
                !!member.timeout && +member.timeout > Date.now();
              const menu = () => (
                <UserContextMenu user={user()!} member={member} />
              );
              return (
                <div
                  class={row()}
                  use:floating={user() ? { contextMenu: menu } : {}}
                  data-timed-out={timedOut() || undefined}
                >
                  <Who>
                    <Avatar
                      src={member.avatarURL ?? user()?.avatarURL}
                      fallback={member.displayName ?? user()?.username}
                      size={36}
                    />
                    <Names>
                      <strong dir="auto">
                        {member.displayName ??
                          user()?.displayName ??
                          user()?.username}
                        <Show when={user()?.bot}>
                          <BotLabel />
                        </Show>
                        <Show when={props.server.ownerId === member.id.user}>
                          <BadgeMark id="server_owner" size="xs" mode="hover" />
                        </Show>
                      </strong>
                      <small dir="ltr">
                        {user()?.username}#{user()?.discriminator}
                        <Show when={timedOut()}>
                          <Timed
                            title={t`Timed out until ${date(member.timeout!)}`}
                          >
                            <Icon name="clock" size={12} />
                            {t`Timed out`}
                          </Timed>
                        </Show>
                      </small>
                    </Names>
                  </Who>
                  <Muted>{date(member.joinedAt)}</Muted>
                  <Muted>{date(new Date(decodeTime(member.id.user)))}</Muted>
                  <Roles>
                    <For each={member.orderedRoles}>
                      {(item) => (
                        <Chip>
                          <Dot
                            style={{
                              background: item.colour ?? "var(--z-fg-muted)",
                            }}
                          />
                          <span dir="auto">{item.name}</span>
                          <Show when={canEditMember(member) && !item.isManaged}>
                            <ChipRemove
                              type="button"
                              aria-label={t`Remove ${item.name}`}
                              onClick={() => removeRole(member, item.id)}
                            >
                              <Icon name="x" size={12} />
                            </ChipRemove>
                          </Show>
                        </Chip>
                      )}
                    </For>
                    <Show when={canEditMember(member)}>
                      <AddRole
                        type="button"
                        aria-label={t`Edit roles`}
                        title={t`Edit roles`}
                        onClick={() =>
                          openModal({ type: "user_profile_roles", member })
                        }
                      >
                        <Icon name="plus" size={14} />
                      </AddRole>
                    </Show>
                  </Roles>
                  <Show when={user()}>
                    <button
                      class={more()}
                      type="button"
                      aria-label={t`Member actions`}
                      title={t`Member actions`}
                      use:floating={{
                        contextMenu: menu,
                        contextMenuHandler: "click",
                      }}
                    >
                      <Icon name="dots-three" size={18} />
                    </button>
                  </Show>
                </div>
              );
            }}
          </For>
          <Show when={members().length > shown() || query.hasNextPage}>
            <ShowMore
              type="button"
              disabled={query.isFetchingNextPage}
              onClick={() => {
                setShown((n) => n + PAGE);
                // near the end of what is loaded: fetch the next page
                if (shown() + PAGE >= members().length && query.hasNextPage) {
                  void query.fetchNextPage();
                }
              }}
            >
              <Show
                when={members().length > shown()}
                fallback={<Trans>Load more members</Trans>}
              >
                <Trans>Show more ({members().length - shown()})</Trans>
              </Show>
            </ShowMore>
          </Show>
        </Match>
      </Switch>
    </SettingsSection>
  );
}

/** Fixed width so the filters do not jump with the chosen text */
const Filter = styled("div", {
  base: { minWidth: 0 },
});

const Toolbar = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 180px 180px",
    gap: "8px",
    padding: "12px 12px 8px",
    mdDown: { gridTemplateColumns: "1fr" },
  },
});

const columns = "minmax(200px, 2fr) 120px 120px minmax(160px, 2fr) 36px";

const Head = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: columns,
    gap: "12px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    mdDown: { display: "none" },
  },
});

const row = cva({
  base: {
    // long lists: rows out of view are not laid out or painted
    contentVisibility: "auto",
    containIntrinsicBlockSize: "auto 64px",
    display: "grid",
    gridTemplateColumns: columns,
    alignItems: "center",
    gap: "12px",
    minHeight: "56px",
    padding: "6px 12px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    _hover: { background: "var(--z-nav-hover)" },
    // narrow: name and actions on top, roles on their own line below
    mdDown: {
      gridTemplateColumns: "minmax(0, 1fr) 36px",
      gridTemplateAreas: '"who more" "roles roles"',
      rowGap: "6px",
      paddingBlock: "10px",
      "& > :nth-child(1)": { gridArea: "who" },
      "& > :nth-child(2), & > :nth-child(3)": { display: "none" },
      "& > :nth-child(4)": { gridArea: "roles", paddingInlineStart: "46px" },
      "& > :nth-child(5)": { gridArea: "more" },
    },
  },
});

const Who = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 },
});

const Names = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    "& strong": {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "14px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& small": {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "12px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Timed = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    color: "var(--z-warning, #F3B96B)",
  },
});

const Muted = styled("span", {
  base: { fontSize: "13px", color: "var(--z-fg-secondary)" },
});

const Roles = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
  },
});

const Chip = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    height: "24px",
    paddingInline: "8px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-border-subtle)",
    maxWidth: "160px",
    "& > span:not([class*=dot])": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Dot = styled("i", {
  base: { flexShrink: 0, width: "10px", height: "10px", borderRadius: "50%" },
});

const ChipRemove = styled("button", {
  base: {
    position: "relative",
    display: "inline-grid",
    placeItems: "center",
    width: "16px",
    height: "16px",
    padding: 0,
    // a 24px hit area around the small ✕ (minimum target size)
    "&::before": { content: "''", position: "absolute", inset: "-4px" },
    marginInlineEnd: "-4px",
    border: "none",
    borderRadius: "50%",
    background: "none",
    color: "var(--z-fg-muted)",
    cursor: "pointer",
    _hover: { color: "var(--z-danger)", background: "var(--z-nav-hover)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const AddRole = styled("button", {
  base: {
    display: "inline-grid",
    placeItems: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    borderRadius: "12px",
    border: "1px dashed var(--z-border-subtle)",
    background: "none",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    _hover: { color: "var(--z-fg-primary)", borderColor: "var(--z-fg-muted)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const more = cva({
  base: {
    display: "grid",
    placeItems: "center",
    width: "32px",
    height: "32px",
    padding: 0,
    borderRadius: "6px",
    border: "none",
    background: "none",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const ShowMore = styled("button", {
  base: {
    margin: "8px 12px 12px",
    height: "36px",
    borderRadius: "var(--z-radius, 8px)",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-btn-surface-bg)",
    color: "var(--z-fg-primary)",
    fontWeight: 600,
    cursor: "pointer",
  },
});
