import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { ColouredText } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { SettingsConfiguration } from ".";
import { ChannelCard } from "./channel/ChannelCard";
import ChannelOverview from "./channel/Overview";
import { ForumTags } from "./channel/ForumTags";
import { ChannelPermissionsEditor } from "./channel/permissions/ChannelPermissionsEditor";
import { ChannelPermissionsOverview } from "./channel/permissions/ChannelPermissionsOverview";
import { WebhooksPanel } from "./server/webhooks/ServerWebhooks";
import { BackCard } from "./user/_AccountCard";

const Config: SettingsConfiguration<Channel> = {
  /**
   * Page titles
   */
  title(ctx, key) {
    const client = useClient();
    const { t } = useLingui();

    if (key.startsWith("webhooks/")) {
      return t`Webhooks`;
    }

    if (key.startsWith("permissions/")) {
      if (key === "permissions/default") return t`Everyone`;
      if (key.startsWith("permissions/@")) {
        const id = key.substring(13);
        const member = client().serverMembers.getByKey({
          server: ctx.context.serverId!,
          user: id,
        });
        return member?.displayName ?? client().users.get(id)?.displayName ?? "";
      }

      return ctx.context.server?.roles.get(key.substring(12))?.name ?? "";
    }

    return ctx.entries
      .flatMap((category) => category.entries)
      .find((entry) => entry.id === key)?.title as string;
  },

  /**
   * Render the current channel settings page
   */
  // we take care of the reactivity ourselves
  /* eslint-disable solid/components-return-once */
  render(props, channel) {
    const id = props.page();
    const client = useClient();

    if (id?.startsWith("webhooks/")) {
      return <WebhooksPanel channel={channel} />;
    }

    if (id?.startsWith("permissions/")) {
      if (id.startsWith("permissions/@")) {
        return (
          <ChannelPermissionsEditor
            type="channel_member"
            context={channel}
            userId={id.substring(13)}
          />
        );
      }

      if (id === "permissions/default") {
        return (
          <ChannelPermissionsEditor type="channel_default" context={channel} />
        );
      }

      return (
        <ChannelPermissionsEditor
          type="channel_role"
          context={channel}
          roleId={id.substring(12)}
        />
      );
    }

    switch (id) {
      case "overview":
        return <ChannelOverview channel={channel} />;
      case "tags":
        return <ForumTags channel={channel} />;
      case "permissions":
        switch (channel.type) {
          case "Group":
            return <ChannelPermissionsEditor type="group" context={channel} />;
          case "TextChannel":
            return <ChannelPermissionsOverview context={channel} />;
          default:
            return null;
        }
      case "webhooks":
        return <WebhooksPanel channel={channel} />;
      default:
        return null;
    }
  },
  /* eslint-enable solid/components-return-once */

  /**
   * Generate list of categories / entries for channel settings
   * @returns List
   */
  list(channel, onClose) {
    const { openModal } = useModals();

    return {
      context: channel,
      prepend: (
        <>
          <BackCard onClose={onClose} />
          <ChannelCard channel={channel} />
        </>
      ),
      entries: [
        {
          title: <Trans>General</Trans>,
          entries: [
            {
              id: "overview",
              icon: <Icon name="info" size={20} />,
              title: <Trans>Overview</Trans>,
            },
            ...(channel.isForum && channel.havePermission("ManageChannel")
              ? [
                  {
                    id: "tags",
                    icon: <Icon name="bookmark-simple" size={20} />,
                    title: <Trans>Tags</Trans>,
                  },
                ]
              : []),
          ],
        },
        {
          hidden:
            channel.type === "SavedMessages" ||
            !channel.havePermission("ManagePermissions"),
          title: <Trans>User management</Trans>,
          entries: [
            {
              id: "permissions",
              icon: <Icon name="shield-check" size={20} />,
              title: <Trans>Permissions</Trans>,
            },
          ],
        },
        {
          // webhooks post messages: voice rooms have no chat
          hidden:
            channel.isVoiceRoom || !channel.havePermission("ManageWebhooks"),
          title: <Trans>Integrations</Trans>,
          entries: [
            {
              id: "webhooks",
              icon: <Icon name="webhooks-logo" size={20} />,
              title: <Trans>Webhooks</Trans>,
            },
          ],
        },
        {
          hidden: !(
            channel.type !== "Group" && channel.havePermission("ManageChannel")
          ),
          entries: [
            {
              icon: (
                <span style={{ "--z-icon-color": "var(--z-icon-danger)" }}>
                  <Icon name="trash" size={20} />
                </span>
              ),
              title: (
                <ColouredText colour="var(--z-danger)">
                  <Trans>Delete channel</Trans>
                </ColouredText>
              ),
              onClick() {
                openModal({
                  type: "delete_channel",
                  channel,
                });
              },
            },
          ],
        },
      ],
    };
  },
};

export default Config;

export type ChannelSettingsProps = {
  /**
   * Channel
   */
  channel: Channel;
};
