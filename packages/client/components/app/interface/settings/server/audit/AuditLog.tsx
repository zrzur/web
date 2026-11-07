import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";

import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/solid/macro";
import type { API, Server, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";
import { decodeTime } from "ulid";

import { useClient } from "@revolt/client";
import {
  Avatar,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { auditQueryString } from "./auditQuery";
import type { IconName } from "@revolt/ui/icons/registry";

type Entry = API.AuditLogEntry;
type Action = Entry["action"];
type Kind = "create" | "edit" | "delete";

/** Action types in groups, for the filter */
const GROUPS: Record<string, Action["type"][]> = {
  members: [
    "MemberEdit",
    "MemberKick",
    "BanCreate",
    "BanDelete",
    // newer than the API types
    "BotAdd" as Action["type"],
    "BotRemove" as Action["type"],
    "AutoModAction" as Action["type"],
  ],
  messages: [
    "MessageDelete",
    "MessageBulkDelete",
    "MessagePin",
    "MessageUnpin",
  ],
  channels: [
    "ChannelCreate",
    "ChannelEdit",
    "ChannelRolePermissionsEdit",
    // newer than the API types
    "ChannelMemberPermissionsEdit" as Action["type"],
    "ChannelDelete",
  ],
  roles: ["RoleCreate", "RoleEdit", "RoleDelete", "RolesReorder"],
  server: ["ServerEdit"],
  invites: ["InviteCreate", "InviteDelete", "WebhookCreate", "WebhookUpdate", "WebhookTokenReset", "WebhookDelete"],
  emojis: ["EmojiCreate", "EmojiUpdate", "EmojiDelete"],
};

const PAGE = 50;

/**
 * Everything that changed in the server, who did it and when
 */
export function AuditLog(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();

  const [group, setGroup] = createSignal("");
  const [actor, setActor] = createSignal("");
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [users, setUsers] = createSignal<Map<string, User>>(new Map());
  const [more, setMore] = createSignal(false);
  const [open, setOpen] = createSignal<string>();

  async function load(before?: string) {
    const { baseURL, headers } = client().api.config;
    const response = await fetch(
      `${baseURL}/servers/${props.server.id}/audit_logs?${auditQueryString({
        limit: PAGE,
        before,
        user: actor() || undefined,
        type: group() ? (GROUPS[group()] as string[]) : undefined,
      })}`,
      { headers: headers as Record<string, string> },
    );
    if (!response.ok) throw await response.json().catch(() => undefined);
    const raw = (await response.json()) as {
      audit_logs: Entry[];
      users: API.User[];
    };
    const result = {
      audit_logs: raw.audit_logs,
      users: raw.users.map((user) => client().users.getOrCreate(user._id, user)),
    };
    setUsers((map) => {
      const next = new Map(map);
      for (const user of result.users) next.set(user.id, user);
      return next;
    });
    setEntries((list) =>
      before ? [...list, ...result.audit_logs] : result.audit_logs,
    );
    setMore(result.audit_logs.length === PAGE);
    return true;
  }

  const [state, { refetch }] = createResource(
    () => [group(), actor()] as const,
    () => load(),
  );

  // ----- names of what entries point at -----
  const userName = (id?: string) => {
    if (!id) return t`someone`;
    const user = users().get(id) ?? client().users.get(id);
    const member = client().serverMembers.getByKey({
      server: props.server.id,
      user: id,
    });
    return (
      member?.displayName ??
      user?.displayName ??
      user?.username ??
      t`a former member`
    );
  };
  // isolated, so "#name" keeps its order inside Arabic sentences
  const channelName = (id?: string, fallback?: string) =>
    `\u2068#${client().channels.get(id ?? "")?.name ?? fallback ?? t`deleted channel`}\u2069`;
  const roleName = (id?: string, fallback?: string) =>
    props.server.roles.get(id ?? "")?.name ?? fallback ?? t`deleted role`;

  /** One sentence per entry, its icon and whether it adds, changes or removes */
  function describe(entry: Entry): {
    text: string;
    icon: IconName;
    kind: Kind;
    /** a bot the entry is about: its avatar replaces the icon */
    bot?: string;
  } {
    // bot entries are newer than the API types
    const raw = entry.action as { type: string; bot?: string };
    if (raw.type === "BotAdd")
      return {
        kind: "create",
        icon: "robot",
        text: t`added the bot ${userName(raw.bot)}`,
        bot: raw.bot,
      };
    if (raw.type === "AutoModAction") {
      const automod = entry.action as unknown as {
        rule: string;
        channel: string;
      };
      return {
        kind: "edit",
        icon: "shield-check",
        text: t`was stopped by the AutoMod rule ${automod.rule} in ${channelName(automod.channel)}`,
      };
    }
    if (raw.type === "BotRemove")
      return {
        kind: "delete",
        icon: "robot",
        text: t`removed the bot ${userName(raw.bot)}`,
        bot: raw.bot,
      };
    const a = entry.action as Action & Record<string, never>;
    switch (a.type) {
      case "MessageDelete":
        return {
          kind: "delete",
          icon: "trash",
          text: t`deleted a message by ${userName(a.author)} in ${channelName(a.channel)}`,
        };
      case "MessageBulkDelete":
        return {
          kind: "delete",
          icon: "trash",
          text: t`deleted ${a.count} messages in ${channelName(a.channel)}`,
        };
      case "MessagePin":
        return {
          kind: "edit",
          icon: "push-pin",
          text: t`pinned a message by ${userName(a.author)} in ${channelName(a.channel)}`,
        };
      case "MessageUnpin":
        return {
          kind: "edit",
          icon: "push-pin",
          text: t`unpinned a message by ${userName(a.author)} in ${channelName(a.channel)}`,
        };
      case "BanCreate":
        return {
          kind: "delete",
          icon: "gavel",
          text: t`banned ${userName(a.user)}`,
        };
      case "BanDelete":
        return {
          kind: "create",
          icon: "gavel",
          text: t`unbanned ${userName(a.user)}`,
        };
      case "MemberKick":
        return {
          kind: "delete",
          icon: "user-minus",
          text: t`removed ${userName(a.user)} from the server`,
        };
      case "MemberEdit": {
        const after = (a.after ?? {}) as Record<string, unknown>;
        const before = (a.before ?? {}) as Record<string, unknown>;
        if (after.timeout)
          return {
            kind: "delete",
            icon: "clock",
            text: t`timed out ${userName(a.user)}`,
          };
        if (before.timeout && !after.timeout)
          return {
            kind: "create",
            icon: "clock",
            text: t`ended ${userName(a.user)}'s timeout`,
          };
        if (after.roles || before.roles)
          return {
            kind: "edit",
            icon: "shield-check",
            text: t`changed ${userName(a.user)}'s roles`,
          };
        if ("nickname" in after || "nickname" in before)
          return {
            kind: "edit",
            icon: "pencil-simple",
            text: t`changed ${userName(a.user)}'s nickname`,
          };
        return {
          kind: "edit",
          icon: "user",
          text: t`updated ${userName(a.user)}`,
        };
      }
      case "ChannelCreate":
        return {
          kind: "create",
          icon: "hash",
          text: t`created ${channelName(a.channel, a.name)}`,
        };
      case "ChannelEdit":
        return {
          kind: "edit",
          icon: "hash",
          text: t`edited ${channelName(a.channel)}`,
        };
      case "ChannelRolePermissionsEdit":
        return {
          kind: "edit",
          icon: "lock-simple",
          text: t`changed ${roleName(a.role)} permissions in ${channelName(a.channel)}`,
        };
      case "ChannelDelete":
        return {
          kind: "delete",
          icon: "hash",
          text: t`deleted ${channelName(undefined, a.name)}`,
        };
      case "RoleCreate":
        return {
          kind: "create",
          icon: "shield-check",
          text: t`created role ${roleName(a.role, a.name)}`,
        };
      case "RoleEdit":
        return {
          kind: "edit",
          icon: "shield-check",
          text: t`edited role ${roleName(a.role)}`,
        };
      case "RoleDelete":
        return {
          kind: "delete",
          icon: "shield-check",
          text: t`deleted role ${a.name}`,
        };
      case "RolesReorder":
        return {
          kind: "edit",
          icon: "shield-check",
          text: t`reordered the roles`,
        };
      case "ServerEdit":
        return {
          kind: "edit",
          icon: "gear-six",
          text: t`updated the server settings`,
        };
      case "InviteCreate":
        return {
          kind: "create",
          icon: "link",
          text: t`created invite ${a.invite} for ${channelName(a.channel)}`,
        };
      case "InviteDelete":
        return {
          kind: "delete",
          icon: "link",
          text: t`deleted invite ${a.invite}`,
        };
      case "WebhookCreate":
        return {
          kind: "create",
          icon: "webhooks-logo",
          text: t`created webhook ${a.name} in ${channelName(a.channel)}`,
        };
      case "WebhookUpdate":
        return {
          kind: "edit",
          icon: "webhooks-logo",
          text: t`edited webhook ${a.name}`,
        };
      case "WebhookTokenReset":
        return {
          kind: "edit",
          icon: "webhooks-logo",
          text: t`made a new address for webhook ${a.name}`,
        };
      case "WebhookDelete":
        return {
          kind: "delete",
          icon: "webhooks-logo",
          text: t`deleted webhook ${a.name}`,
        };
      case "EmojiCreate":
        return {
          kind: "create",
          icon: "smiley",
          text: t`added emoji :${a.name}:`,
        };
      case "EmojiUpdate":
        return { kind: "edit", icon: "smiley", text: t`edited an emoji` };
      case "EmojiDelete":
        return {
          kind: "delete",
          icon: "smiley",
          text: t`deleted emoji :${a.name}:`,
        };
      default: {
        const other = a as { type: string; channel?: string; member?: string };
        if (other.type === "ChannelMemberPermissionsEdit")
          return {
            kind: "edit",
            icon: "lock-simple",
            text: t`changed permissions of ${userName(other.member)} in ${channelName(other.channel)}`,
          };
        return { kind: "edit", icon: "info", text: other.type };
      }
    }
  }

  // ----- before / after of edits -----
  const fieldName = (key: string) =>
    (
      ({
        name: t`Name`,
        description: t`Description`,
        icon: t`Icon`,
        banner: t`Banner`,
        nsfw: t`Age-restricted`,
        colour: t`Colour`,
        hoist: t`Shown separately`,
        rank: t`Position`,
        nickname: t`Nickname`,
        avatar: t`Server avatar`,
        roles: t`Roles`,
        timeout: t`Timeout`,
        permissions: t`Permissions`,
        default_permissions: t`Default permissions`,
        role_permissions: t`Role permissions`,
        categories: t`Categories`,
        system_messages: t`System messages`,
        slowmode: t`Slow mode`,
      }) as Record<string, string>
    )[key] ?? key;

  function show(key: string, value: unknown): string {
    if (value === undefined || value === null || value === "") return "—";
    if (key === "roles" && Array.isArray(value))
      return value.map((id) => roleName(id)).join(", ") || "—";
    if (key === "timeout" && typeof value === "string")
      return date(new Date(value), true);
    if (typeof value === "boolean") return value ? t`Yes` : t`No`;
    if (typeof value === "string" || typeof value === "number")
      return String(value);
    if (key === "icon" || key === "banner" || key === "avatar")
      return t`new image`;
    return t`changed`;
  }

  function changes(entry: Entry) {
    const a = entry.action as {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    };
    if (!a.before && !a.after) return [];
    const keys = new Set([
      ...Object.keys(a.before ?? {}),
      ...Object.keys(a.after ?? {}),
    ]);
    return [...keys]
      .filter((key) => key !== "_id" && key !== "id")
      .map((key) => ({
        key,
        before: show(key, a.before?.[key]),
        after: show(key, a.after?.[key]),
      }));
  }

  // ----- time -----
  const time = (entry: Entry) => new Date(decodeTime(entry._id));
  const date = (value: Date, withTime = false) =>
    new Intl.DateTimeFormat(
      i18n.locale,
      withTime
        ? { dateStyle: "medium", timeStyle: "short" }
        : { timeStyle: "short" },
    ).format(value);
  const day = (value: Date) =>
    new Intl.DateTimeFormat(i18n.locale, { dateStyle: "full" }).format(value);

  const days = createMemo(() => {
    const groups: { day: string; entries: Entry[] }[] = [];
    for (const entry of entries()) {
      const label = day(time(entry));
      if (groups.at(-1)?.day !== label)
        groups.push({ day: label, entries: [] });
      groups.at(-1)!.entries.push(entry);
    }
    return groups;
  });

  const actors = createMemo(() => [...users().values()]);

  return (
    <SettingsSection
      description={
        <Trans>
          Everything that changed in this server, who did it and when.
        </Trans>
      }
    >
      <Toolbar>
        <FloatingSelect
          aria-label={t`Filter by person`}
          value={actor() || "all"}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setActor(value === "all" ? "" : value);
          }}
        >
          <MenuItem value="all">{t`Everyone`}</MenuItem>
          <For each={actors()}>
            {(user) => <MenuItem value={user.id}>{userName(user.id)}</MenuItem>}
          </For>
        </FloatingSelect>
        <FloatingSelect
          aria-label={t`Filter by action`}
          value={group() || "all"}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setGroup(value === "all" ? "" : value);
          }}
        >
          <MenuItem value="all">{t`All actions`}</MenuItem>
          <MenuItem value="members">{t`Members and bans`}</MenuItem>
          <MenuItem value="messages">{t`Messages`}</MenuItem>
          <MenuItem value="channels">{t`Channels`}</MenuItem>
          <MenuItem value="roles">{t`Roles`}</MenuItem>
          <MenuItem value="server">{t`Server settings`}</MenuItem>
          <MenuItem value="invites">{t`Invites and webhooks`}</MenuItem>
          <MenuItem value="emojis">{t`Emojis`}</MenuItem>
        </FloatingSelect>
      </Toolbar>

      <Switch>
        <Match when={state.loading && !entries().length}>
          <SettingsRow
            icon={<Icon name="clock-counter-clockwise" size={20} />}
            title={<Trans>Loading the audit log…</Trans>}
          />
        </Match>
        <Match when={state.error}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            danger
            title={<Trans>The audit log couldn't be loaded</Trans>}
          />
        </Match>
        <Match when={!entries().length}>
          <SettingsRow
            icon={<Icon name="clock-counter-clockwise" size={20} />}
            title={<Trans>Nothing here yet</Trans>}
          />
        </Match>
        <Match when={true}>
          <For each={days()}>
            {(group) => (
              <>
                <Day>{group.day}</Day>
                <For each={group.entries}>
                  {(entry) => {
                    const info = () => describe(entry);
                    const diff = () => changes(entry);
                    const expanded = () => open() === entry._id;
                    return (
                      <Item data-kind={info().kind}>
                        <ItemRow
                          type="button"
                          aria-expanded={diff().length ? expanded() : undefined}
                          disabled={!diff().length && !entry.reason}
                          onClick={() =>
                            setOpen(expanded() ? undefined : entry._id)
                          }
                        >
                          <Badge>
                            <Show
                              when={info().bot}
                              fallback={<Icon name={info().icon} size={16} />}
                            >
                              <Avatar
                                src={
                                  (
                                    users().get(info().bot!) ??
                                    client().users.get(info().bot!)
                                  )?.avatarURL
                                }
                                fallback={userName(info().bot)}
                                size={16}
                              />
                            </Show>
                          </Badge>
                          <Avatar
                            src={
                              (
                                users().get(entry.user) ??
                                client().users.get(entry.user)
                              )?.avatarURL
                            }
                            fallback={userName(entry.user)}
                            size={28}
                          />
                          <Text>
                            <strong dir="auto">{userName(entry.user)}</strong>{" "}
                            <span dir="auto">{info().text}</span>
                            <Show when={entry.reason}>
                              <Reason dir="auto">“{entry.reason}”</Reason>
                            </Show>
                          </Text>
                          <When title={date(time(entry), true)}>
                            {date(time(entry))}
                          </When>
                          {/* always there, so the times line up */}
                          <Chevron
                            data-open={expanded() || undefined}
                            aria-hidden="true"
                          >
                            <Show when={diff().length}>
                              <Icon name="caret-down" size={14} />
                            </Show>
                          </Chevron>
                        </ItemRow>
                        <Show when={expanded() && diff().length}>
                          <Changes>
                            <For each={diff()}>
                              {(change) => (
                                <li>
                                  <span>{fieldName(change.key)}</span>
                                  <del dir="auto">{change.before}</del>
                                  <Icon name="arrow-right" size={12} />
                                  <ins dir="auto">{change.after}</ins>
                                </li>
                              )}
                            </For>
                          </Changes>
                        </Show>
                      </Item>
                    );
                  }}
                </For>
              </>
            )}
          </For>
          <Show when={more()}>
            <LoadMore
              type="button"
              disabled={state.loading}
              onClick={() => load(entries().at(-1)?._id)}
            >
              <Trans>Load older entries</Trans>
            </LoadMore>
          </Show>
          <Refresh type="button" onClick={() => refetch()}>
            <Icon name="arrow-clockwise" size={14} /> <Trans>Refresh</Trans>
          </Refresh>
        </Match>
      </Switch>
    </SettingsSection>
  );
}

const Toolbar = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    padding: "12px 12px 8px",
    mdDown: { gridTemplateColumns: "1fr" },
  },
});

const Day = styled("h4", {
  base: {
    margin: 0,
    padding: "14px 12px 6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-muted)",
  },
});

const Item = styled("div", {
  base: {
    borderBlockStart: "1px solid var(--z-border-subtle)",
    "--kind": "var(--z-accent)",
    "&[data-kind=create]": { "--kind": "var(--z-success, #55DCC8)" },
    "&[data-kind=delete]": { "--kind": "var(--z-danger)" },
  },
});

const ItemRow = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    minHeight: "52px",
    padding: "8px 12px",
    border: "none",
    background: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    _disabled: { cursor: "default", _hover: { background: "none" } },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
  },
});

const Badge = styled("span", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    color: "var(--kind)",
  },
});

const Text = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "& strong": { color: "var(--z-fg-primary)", fontWeight: 600 },
  },
});

const Reason = styled("span", {
  base: {
    display: "block",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    fontStyle: "italic",
  },
});

const When = styled("time", {
  base: { flexShrink: 0, fontSize: "12px", color: "var(--z-fg-muted)" },
});

const Chevron = styled("span", {
  base: {
    flexShrink: 0,
    width: "14px",
    display: "grid",
    color: "var(--z-fg-muted)",
    transition: "transform var(--z-motion-fast, 120ms)",
    "&[data-open]": { transform: "rotate(180deg)" },
  },
});

const Changes = styled("ul", {
  base: {
    margin: 0,
    padding: "0 12px 12px 88px",
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "13px",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
    },
    "& li > span": { minWidth: "120px", color: "var(--z-fg-muted)" },
    "& del": { color: "var(--z-danger)", textDecoration: "line-through" },
    "& ins": { color: "var(--z-success, #55DCC8)", textDecoration: "none" },
    mdDown: { paddingInlineStart: "12px" },
  },
});

const LoadMore = styled("button", {
  base: {
    margin: "8px 12px 4px",
    height: "36px",
    borderRadius: "var(--z-radius, 8px)",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-btn-surface-bg)",
    color: "var(--z-fg-primary)",
    fontWeight: 600,
    cursor: "pointer",
    _hover: { background: "var(--z-btn-surface-hover, var(--z-nav-hover))" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _disabled: { opacity: 0.6, cursor: "default" },
  },
});

const Refresh = styled("button", {
  base: {
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "32px",
    paddingInline: "12px",
    margin: "4px 12px 12px",
    border: "none",
    borderRadius: "var(--z-radius-sm)",
    background: "none",
    color: "var(--z-link)",
    fontSize: "13px",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});
