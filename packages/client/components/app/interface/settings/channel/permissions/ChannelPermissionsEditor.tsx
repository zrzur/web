import { For, Show, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import {
  API,
  Channel,
  DEFAULT_PERMISSION_DIRECT_MESSAGE,
  Server,
} from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  Button,
  Column,
  SettingsRow,
  SettingsSaveBar,
  SettingsSection,
  Toggle,
  Switch as UiSwitch,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { isAdminLike, isAdministrator, isDangerous } from "./dangerous";

const VIEW_CHANNEL = 2n ** 20n;

type Props = (
  | { type: "server_default"; context: Server }
  | { type: "server_role"; context: Server; roleId: string }
  | { type: "channel_default"; context: Channel }
  | { type: "channel_role"; context: Channel; roleId: string }
  | { type: "channel_member"; context: Channel; userId: string }
  | { type: "group"; context: Channel }
  | { type: "category_default"; context: Server; categoryId: string }
  | {
      type: "category_role";
      context: Server;
      categoryId: string;
      roleId: string;
    }
) & {
  additionalActions?: {
    isDirty: () => boolean;
    isPending: () => boolean;
    canSave: () => boolean;
    save: () => Promise<boolean>;
    reset: () => void;
  };
  saveLabel?: string;
};

type Context = API.Channel["channel_type"] | "Server";

/** A category's stored overrides, newer than the API types */
type CategoryOverrides = {
  default_permissions?: { a: number; d: number };
  role_permissions?: Record<string, { a: number; d: number }>;
};

function categoryOf(server: Server, id: string) {
  return server.categories?.find((category) => category.id === id) as
    | CategoryOverrides
    | undefined;
}

/** What a channel uses now: its category's overrides when synced */
function channelOverrides(channel: Channel) {
  const category = channel.syncedCategory as CategoryOverrides | undefined;
  if (!category) {
    return {
      default: channel.defaultPermissions,
      roles: channel.rolePermissions,
    };
  }
  return {
    default: category.default_permissions,
    roles: category.role_permissions,
  };
}

/**
 * Generic editor for any channel permissions
 */
export function ChannelPermissionsEditor(props: Props) {
  const { t } = useLingui();

  const context: Context =
    // eslint-disable-next-line solid/reactivity
    props.type === "category_default" || props.type === "category_role"
      ? "TextChannel"
      : props.context instanceof Server
        ? "Server"
        : props.context.type;

  /**
   * Current permission value, normalised to [allow, deny]
   * @returns [allow, deny] BigInts
   */
  function currentValue() {
    switch (props.type) {
      case "server_default":
        return [BigInt(props.context.defaultPermissions), BigInt(0)];
      case "server_role":
        return [
          BigInt(props.context.roles?.get(props.roleId)?.permissions.a || 0),
          BigInt(props.context.roles?.get(props.roleId)?.permissions.d || 0),
        ];
      case "channel_default": {
        const value = channelOverrides(props.context).default;
        return [BigInt(value?.a || 0), BigInt(value?.d || 0)];
      }
      case "channel_role": {
        const value = channelOverrides(props.context).roles?.[props.roleId];
        return [BigInt(value?.a || 0), BigInt(value?.d || 0)];
      }
      case "category_default": {
        const value = categoryOf(
          props.context,
          props.categoryId,
        )?.default_permissions;
        return [BigInt(value?.a || 0), BigInt(value?.d || 0)];
      }
      case "category_role": {
        const value = categoryOf(props.context, props.categoryId)
          ?.role_permissions?.[props.roleId];
        return [BigInt(value?.a || 0), BigInt(value?.d || 0)];
      }
      case "channel_member":
        return [
          BigInt(props.context.memberPermissions?.[props.userId]?.a || 0),
          BigInt(props.context.memberPermissions?.[props.userId]?.d || 0),
        ];
      case "group":
        return [
          BigInt(
            props.context.permissions ?? DEFAULT_PERMISSION_DIRECT_MESSAGE,
          ),
          BigInt(0),
        ];
    }
  }

  /**
   * Current edited values
   */
  const [value, setValue] = createSignal(currentValue());
  const [isPending, setPending] = createSignal(false);

  /**
   * Whether there is a pending save
   */
  function unsavedChanges() {
    const [a1, a2] = currentValue(),
      [b1, b2] = value();

    return a1 !== b1 || a2 !== b2;
  }

  function hasChanges() {
    return unsavedChanges() || !!props.additionalActions?.isDirty();
  }

  function savePending() {
    return isPending() || !!props.additionalActions?.isPending();
  }

  /**
   * Reset to the current value
   */
  function resetPermissions() {
    setValue(currentValue());
  }

  function reset() {
    resetPermissions();
    props.additionalActions?.reset();
  }

  /**
   * Commit changes
   * @todo mutator
   */
  function savePermissions() {
    switch (props.type) {
      case "server_default":
        return props.context.setPermissions(undefined, Number(value()[0]));
      case "server_role":
        return props.context.setPermissions(props.roleId, {
          allow: Number(value()[0]),
          deny: Number(value()[1]),
        });
      case "channel_default":
        return props.context.setPermissions(undefined, {
          allow: Number(value()[0]),
          deny: Number(value()[1]),
        });
      case "channel_role":
        return props.context.setPermissions(props.roleId, {
          allow: Number(value()[0]),
          deny: Number(value()[1]),
        });
      case "channel_member":
        return props.context.setMemberPermissions(props.userId, {
          allow: Number(value()[0]),
          deny: Number(value()[1]),
        });
      case "group":
        return props.context.setPermissions(undefined, Number(value()[0]));
      case "category_default":
        return props.context.setCategoryPermissions(
          props.categoryId,
          "default",
          { allow: Number(value()[0]), deny: Number(value()[1]) },
        );
      case "category_role":
        return props.context.setCategoryPermissions(
          props.categoryId,
          props.roleId,
          { allow: Number(value()[0]), deny: Number(value()[1]) },
        );
    }
  }

  async function save() {
    if (savePending()) return;

    setPending(true);
    try {
      if (
        props.additionalActions?.isDirty() &&
        !(await props.additionalActions.save())
      ) {
        return;
      }

      if (unsavedChanges()) await savePermissions();
    } finally {
      setPending(false);
    }
  }

  const Permissions: {
    heading?: string;
    key: string;
    value: bigint;
    title: string;
    description: Partial<Record<Context | "Any", string>>;
    /** Where the usual wording says "this channel" and a category has many */
    categoryDescription?: string;
    /** For a server role, where Allow means more than on @everyone */
    roleDescription?: string;
  }[] = [
    {
      heading: t`Admin`,
      key: "Administrator",
      value: 2n ** 46n,
      title: t`Administrator`,
      description: {
        Server: t`Every right in every channel, private ones too, whatever their settings say. Only an administrator or the owner can give it.`,
      },
    },
    {
      key: "ManageChannel",
      value: 1n ** 0n,
      title: t`Manage channel`,
      description: {
        Group: t`Edit group name and description`,
        Any: t`Edit and delete channel`,
      },
    },
    {
      key: "ManageServer",
      value: 2n ** 1n,
      title: t`Manage server`,
      description: {
        Server: t`Edit the server's information and settings`,
      },
    },
    {
      key: "ManagePermissions",
      value: 2n ** 2n,
      title: t`Manage permissions`,
      description: {
        Group: t`Whether other users can edit these settings`,
        TextChannel: t`Edit channel-specific role and default permissions`,
        Server: t`Edit any permissions on the server`,
      },
    },
    {
      key: "ManageRole",
      value: 2n ** 3n,
      title: t`Manage roles`,
      description: {
        Server: t`Create and edit server roles`,
      },
    },
    {
      key: "ManageCustomisation",
      value: 2n ** 4n,
      title: t`Manage customisation`,
      description: {
        Server: t`Create server emoji`,
      },
    },
    {
      heading: t`Members`,
      key: "KickMembers",
      value: 2n ** 6n,
      title: t`Kick members`,
      description: {
        Server: t`Kick lower-ranking members from the server`,
      },
    },
    {
      key: "BanMembers",
      value: 2n ** 7n,
      title: t`Ban members`,
      description: {
        Server: t`Ban lower-ranking members from the server`,
      },
    },
    {
      key: "TimeoutMembers",
      value: 2n ** 8n,
      title: t`Timeout members`,
      description: {
        Server: t`Temporarily prevent lower-ranking members from interacting`,
      },
    },
    {
      key: "AssignRoles",
      value: 2n ** 9n,
      title: t`Assign roles`,
      description: {
        Server: t`Assign lower-ranked roles to lower-ranking members`,
      },
    },
    {
      key: "ManageJoinRequests",
      value: 2n ** 42n,
      title: t`Manage join requests`,
      description: {
        Server: t`Approve or reject people who ask to join a private server`,
      },
    },
    {
      key: "ViewAuditLogs",
      value: 2n ** 40n,
      title: t`View audit log`,
      description: {
        Server: t`See who changed what on the server`,
      },
    },
    {
      key: "ChangeNickname",
      value: 2n ** 10n,
      title: t`Change nickname`,
      description: {
        Server: t`Change own nickname`,
      },
    },
    {
      key: "ManageNicknames",
      value: 2n ** 11n,
      title: t`Manage nicknames`,
      description: {
        Server: t`Change other members' nicknames`,
      },
    },
    {
      key: "ChangeAvavar",
      value: 2n ** 12n,
      title: t`Change avatar`,
      description: {
        Server: t`Change own avatar`,
      },
    },
    {
      key: "RemoveAvatars",
      value: 2n ** 13n,
      title: t`Remove avatars`,
      description: {
        Server: t`Remove other members' avatars`,
      },
    },
    {
      heading: t`Channels`,
      key: "ViewChannel",
      value: 2n ** 20n,
      title: t`View channel`,
      description: {
        TextChannel: t`Able to access this channel`,
        Server: t`Able to access channels on this server`,
      },
      roleDescription: t`Allow: this role also sees private channels, unless a channel denies it. Default: only the channels everyone sees.`,
    },
    {
      key: "ReadMessageHistory",
      value: 2n ** 21n,
      title: t`Read message history`,
      description: {
        TextChannel: t`Read past messages sent in channel`,
        Server: t`Read past messages sent in channels`,
      },
    },
    {
      key: "SendMessage",
      value: 2n ** 22n,
      title: t`Send messages`,
      description: {
        Group: t`Send messages in channel`,
        TextChannel: t`Send messages in channel`,
        Server: t`Send messages in channels`,
      },
    },
    {
      key: "ManageMessages",
      value: 2n ** 23n,
      title: t`Manage messages`,
      description: {
        Group: t`Delete and pin messages sent by other members`,
        TextChannel: t`Delete and pin messages sent by other members`,
        Server: t`Delete and pin messages sent by other members`,
      },
    },
    {
      key: "ManageWebhooks",
      value: 2n ** 24n,
      title: t`Manage webhooks`,
      description: {
        Group: t`Create and edit webhooks`,
        TextChannel: t`Create and edit webhooks`,
        Server: t`Create and edit webhooks`,
      },
    },
    {
      key: "InviteOthers",
      value: 2n ** 25n,
      title: t`Invite others`,
      description: {
        Group: t`Add new members to the group`,
        Any: t`Create invites for others to use`,
      },
    },
    {
      heading: t`Messaging`,
      key: "SendEmbeds",
      value: 2n ** 26n,
      title: t`Send embeds`,
      description: {
        Any: t`Send embedded content such as link embeds or custom embeds`,
      },
    },
    {
      key: "UploadFiles",
      value: 2n ** 27n,
      title: t`Upload files`,
      description: {
        Any: t`Send attachments to chat`,
      },
    },
    {
      key: "Masquerade",
      value: 2n ** 28n,
      title: t`Masquerade`,
      description: {
        Any: t`Allow members to change name and avatar per-message`,
      },
    },
    {
      key: "React",
      value: 2n ** 29n,
      title: t`React`,
      description: {
        Any: t`React to messages with emoji`,
      },
    },
    {
      key: "UseExternalEmojis",
      value: 2n ** 41n,
      title: t`Use emojis from other servers`,
      description: {
        Any: t`Send and react with custom emojis from other servers`,
      },
    },

    {
      key: "BypassSlowmode",
      value: 2n ** 39n,
      title: t`Bypass slowmode`,
      description: {
        Server: t`Bypasses slowmode in channels`,
        TextChannel: t`Bypasses slowmode in channels`,
      },
    },
    {
      heading: t`Threads and forums`,
      key: "CreateThreads",
      value: 2n ** 43n,
      title: t`Create threads`,
      description: {
        TextChannel: t`Start threads in this channel`,
        Server: t`Start threads in the text channels of this server`,
      },
      categoryDescription: t`Start threads in the text channels of this category`,
    },
    {
      key: "SendMessageInThreads",
      value: 2n ** 44n,
      title: t`Send messages in threads`,
      description: {
        TextChannel: t`Write in the threads and posts of this channel`,
        Server: t`Write in the threads and forum posts of this server`,
      },
      categoryDescription: t`Write in the threads and forum posts of this category`,
    },
    {
      key: "CreateForumPosts",
      value: 2n ** 45n,
      title: t`Create forum posts`,
      description: {
        TextChannel: t`Start posts in this forum`,
        Server: t`Start posts in the forums of this server`,
      },
      categoryDescription: t`Start posts in the forums of this category`,
    },

    {
      heading: t`Voice`,
      key: "Connect",
      value: 2n ** 30n,
      title: t`Connect`,
      description: {
        TextChannel: t`Connect to voice channel`,
        Server: t`Connect to voice channel`,
      },
    },
    {
      key: "Speak",
      value: 2n ** 31n,
      title: t`Speak`,
      description: {
        TextChannel: t`Able to speak in voice call`,
        Server: t`Able to speak in voice call`,
      },
    },
    {
      key: "Video",
      value: 2n ** 32n,
      title: t`Video`,
      description: {
        TextChannel: t`Share camera or screen in voice call`,
        Server: t`Share camera or screen in voice call`,
      },
    },
    {
      key: "MuteMembers",
      value: 2n ** 33n,
      title: t`Mute members`,
      description: {
        TextChannel: t`Mute lower-ranking members in voice call`,
        Server: t`Mute lower-ranking members in voice call`,
      },
    },
    {
      key: "DeafenMembers",
      value: 2n ** 34n,
      title: t`Deafen members`,
      description: {
        TextChannel: t`Deafen lower-ranking members in voice call`,
        Server: t`Deafen lower-ranking members in voice call`,
      },
    },
    {
      key: "MoveMembers",
      value: 2n ** 35n,
      title: t`Move members`,
      description: {
        TextChannel: t`Move members between voice channels`,
        Server: t`Move members between voice channels`,
      },
    },
    {
      key: "Listen",
      value: 2n ** 36n,
      title: t`Listen`,
      description: {
        TextChannel: t`Hear other people and see their video`,
        Server: t`Hear other people and see their video`,
      },
    },
    {
      key: "UseSoundboard",
      value: 2n ** 47n,
      title: t`Use soundboard`,
      description: {
        TextChannel: t`Play the server's sounds in a voice call`,
        Server: t`Play the server's sounds in a voice call`,
      },
    },
    {
      key: "ManageSoundboard",
      value: 2n ** 48n,
      title: t`Manage soundboard`,
      description: {
        Server: t`Add and remove the server's sounds`,
      },
    },
    {
      heading: t`Mentions`,
      key: "MentionEveryone",
      value: 2n ** 37n,
      title: t`Mention everyone`,
      description: {
        Any: t`Mention everyone and online members inside the server`,
      },
    },
    {
      key: "MentionRoles",
      value: 2n ** 38n,
      title: t`Mention roles`,
      description: {
        Any: t`Mention specific roles`,
      },
    },
  ];

  /**
   * Find description for this permission in context
   * If null, don't show this permission entry
   * @param entry Entry
   * @returns Description or null
   */
  function description(entry: (typeof Permissions)[number]) {
    // a channel is a forum or not, so only one way of starting things
    // applies, and a voice room has no threads at all
    if (
      (entry.key === "CreateThreads" && channelKind() === "forum") ||
      (entry.key === "CreateForumPosts" && channelKind() === "text") ||
      (entry.categoryDescription && channelKind() === "voice")
    ) {
      return undefined;
    }
    if (
      entry.categoryDescription &&
      (props.type === "category_default" || props.type === "category_role")
    ) {
      return entry.categoryDescription;
    }
    // only a role can make someone an administrator, never @everyone
    if (entry.key === "Administrator" && props.type !== "server_role") {
      return undefined;
    }
    if (entry.roleDescription && props.type === "server_role") {
      return entry.roleDescription;
    }
    const desc = entry.description;
    return desc[context] ?? desc.Any;
  }

  /** The kind of channel these overrides are on; undefined for wider editors */
  function channelKind() {
    if (props.context instanceof Server) return undefined;
    if (props.context.isVoice) return "voice";
    return props.context.isForum ? "forum" : "text";
  }

  /**
   * Permissions split into their headed groups, keeping only those that
   * apply here
   */
  const groups = () => {
    const out: { heading: string; entries: typeof Permissions }[] = [];
    for (const entry of Permissions) {
      if (entry.heading || !out.length)
        out.push({ heading: entry.heading ?? "", entries: [] });
      if (description(entry)) out[out.length - 1].entries.push(entry);
    }
    return out.filter((group) => group.entries.length);
  };

  const isOverride = () =>
    [
      "channel_default",
      "channel_role",
      "channel_member",
      "server_role",
      "category_default",
      "category_role",
    ].includes(props.type);

  return (
    <Column gap="xl">
      <Show when={isOverride()}>
        <Legend>
          <span data-kind="allow">
            <Icon name="check" size={14} />
            {t`Allow`}
          </span>
          <span data-kind="neutral">
            <Icon name="minus" size={14} />
            {t`Default (inherit)`}
          </span>
          <span data-kind="deny">
            <Icon name="x" size={14} />
            {t`Deny`}
          </span>
        </Legend>
      </Show>

      <Show when={isAdministrator(value()[0])}>
        <SettingsRow
          icon={<Icon name="warning-circle" size={20} />}
          title={t`This role can do everything in the server`}
          description={t`Its members see every channel and have every right, except what only the owner can do.`}
        />
      </Show>

      <Show when={!isAdministrator(value()[0]) && isAdminLike(value()[0])}>
        <SettingsRow
          icon={<Icon name="warning-circle" size={20} />}
          title={t`This can change almost anything in the server`}
          description={t`Manage server, permissions and roles together are close to full control.`}
        />
        <Show
          when={
            props.type === "server_role" &&
            (value()[0] & VIEW_CHANNEL) !== VIEW_CHANNEL &&
            (value()[1] & VIEW_CHANNEL) !== VIEW_CHANNEL
          }
        >
          <SettingsRow
            icon={<Icon name="lock-simple" size={20} />}
            title={t`It doesn't see private channels yet`}
            description={t`View channel is on Default. Allow it so this role sees every channel, private ones too.`}
            control={() => (
              <Button
                size="sm"
                variant="tonal"
                data-testid="role-allow-private-channels"
                onPress={() =>
                  setValue((v) => [v[0] | VIEW_CHANNEL, v[1] & ~VIEW_CHANNEL])
                }
              >
                {t`Allow View channel`}
              </Button>
            )}
          />
        </Show>
      </Show>

      <For each={groups()}>
        {(group) => (
          <SettingsSection title={group.heading}>
            <For each={group.entries}>
              {(entry) => {
                const havePermission = () =>
                  (props.context.permission & entry.value) === entry.value;
                const allowed = () => (value()[0] & entry.value) == entry.value;
                return (
                  <SettingsRow
                    title={entry.title}
                    description={
                      <>
                        {description(entry) as string}
                        <Show when={isDangerous(entry.key) && allowed()}>
                          <Warning>
                            {t`Powerful: give it only to people you trust.`}
                          </Warning>
                        </Show>
                      </>
                    }
                    disabled={!havePermission()}
                    onClick={
                      isOverride()
                        ? undefined
                        : () =>
                            setValue((v) => [v[0] ^ BigInt(entry.value), v[1]])
                    }
                    control={(ids) => (
                      <Show
                        when={isOverride()}
                        fallback={
                          <Toggle
                            checked={(value()[0] & entry.value) == entry.value}
                            disabled={!havePermission()}
                            onChange={() =>
                              setValue((v) => [
                                v[0] ^ BigInt(entry.value),
                                v[1],
                              ])
                            }
                            aria-labelledby={ids.labelId}
                            aria-describedby={ids.descriptionId}
                          />
                        }
                      >
                        <UiSwitch.Override
                          disabled={!havePermission()}
                          labelledBy={ids.labelId}
                          value={
                            (value()[0] & entry.value) == entry.value
                              ? "allow"
                              : (value()[1] & entry.value) == entry.value
                                ? "deny"
                                : "neutral"
                          }
                          onChange={(target) => {
                            let allow = value()[0] & ~entry.value;
                            let deny = value()[1] & ~entry.value;

                            if (target === "allow") allow |= entry.value;
                            if (target === "deny") deny |= entry.value;

                            setValue([allow, deny]);
                          }}
                        />
                      </Show>
                    )}
                  />
                );
              }}
            </For>
          </SettingsSection>
        )}
      </For>

      <SettingsSaveBar
        show={hasChanges()}
        saving={savePending()}
        canSave={
          !(
            props.additionalActions?.isDirty() &&
            !props.additionalActions.canSave()
          )
        }
        onReset={reset}
        onSave={save}
        saveLabel={props.saveLabel}
      />
    </Column>
  );
}

const Legend = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 16px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",

    "& span": {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
    },
    "& [data-kind='allow']": { "--z-icon-color": "var(--z-status-success)" },
    "& [data-kind='neutral']": { "--z-icon-color": "var(--z-icon-muted)" },
    "& [data-kind='deny']": { "--z-icon-color": "var(--z-danger)" },
  },
});

/** A short caution under a powerful permission */
const Warning = styled("span", {
  base: {
    display: "block",
    marginTop: "2px",
    color: "var(--z-warning)",
    fontWeight: 600,
  },
});
