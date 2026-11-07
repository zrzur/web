import { Match, Show, Switch } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";

import {
  badge as MdBadge,
  delete as MdDelete,
  group_add as MdGroupAdd,
  library_add as MdLibraryAdd,
  link as MdLink,
  logout as MdLogout,
  mark_chat_read as MdMarkChatRead,
  report as MdReport,
  settings as MdSettings,
} from "@revolt/ui/icons/legacy";

import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "./ContextMenu";
import { NotificationContextMenu } from "./shared/NotificationContextMenu";

/**
 * Context menu for channels
 */
export function ChannelContextMenu(props: { channel: Channel }) {
  const state = useState();
  const instance = useInstance();
  const { openModal } = useModals();
  const client = useClient();

  /**
   * Mark channel as read
   */
  function markAsRead() {
    props.channel.ack();
  }

  /**
   * Create a new invite
   */
  function createInvite() {
    openModal({
      type: "create_invite",
      channel: props.channel,
    });
  }

  function getCategory(channel: Channel) {
    const cats = channel.server!.orderedChannels;
    let cat, ch;
    for (cat of cats)
      for (ch of cat.channels) if (ch.id === channel.id) return cat.id;
  }

  /**
   * Create a new channel
   */
  function createChannel() {
    openModal({
      type: "create_channel",
      server: props.channel.server!,
      categoryId: getCategory(props.channel),
    });
  }

  /**
   * Create a new category
   */
  function createCategory() {
    openModal({
      type: "create_category",
      server: props.channel.server!,
    });
  }

  /**
   * Edit channel
   */
  function editChannel() {
    openModal({
      type: "settings",
      config: "channel",
      context: props.channel,
    });
  }

  /**
   * Delete channel
   */
  function deleteChannel() {
    openModal({
      type: "delete_channel",
      channel: props.channel,
    });
  }

  /**
   * Copy channel link to clipboard
   */
  function copyLink() {
    navigator.clipboard.writeText(
      instance.href(
        `${
          props.channel.server ? `/server/${props.channel.server?.id}` : ""
        }/channel/${props.channel.id}`,
      ),
    );
  }

  /**
   * Copy channel id to clipboard
   */
  function report() {
    openModal({
      type: "report_content",
      client: client(),
      target: {
        kind: "Channel",
        id: props.channel.id,
        label: props.channel.name,
      },
    });
  }

  function copyId() {
    navigator.clipboard.writeText(props.channel.id);
  }

  return (
    <ContextMenu>
      <Show
        when={
          props.channel.unread ||
          !!props.channel.mentions?.size ||
          props.channel.havePermission("InviteOthers")
        }
      >
        <Show when={props.channel.unread || !!props.channel.mentions?.size}>
          <ContextMenuButton icon={MdMarkChatRead} onClick={markAsRead}>
            <Trans>Mark as read</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={props.channel.havePermission("InviteOthers")}>
          <ContextMenuButton icon={MdGroupAdd} onClick={createInvite}>
            <Trans>Create invite</Trans>
          </ContextMenuButton>
        </Show>
        <ContextMenuDivider />
      </Show>

      <NotificationContextMenu channel={props.channel} />

      <ContextMenuDivider />

      <Show when={props.channel.server?.havePermission("ManageChannel")}>
        <ContextMenuButton icon={MdLibraryAdd} onClick={createChannel}>
          <Trans>Create channel</Trans>
        </ContextMenuButton>
        <ContextMenuButton icon={MdLibraryAdd} onClick={createCategory}>
          <Trans>Create category</Trans>
        </ContextMenuButton>
      </Show>
      <Show when={props.channel.havePermission("ManageChannel")}>
        <ContextMenuButton icon={MdSettings} onClick={editChannel}>
          <Trans>Open channel settings</Trans>
        </ContextMenuButton>
      </Show>
      {/* every member may leave a group; deleting needs Manage Channel */}
      <Show
        when={
          props.channel.type === "Group" ||
          props.channel.havePermission("ManageChannel")
        }
      >
        <ContextMenuButton
          icon={props.channel.type === "Group" ? MdLogout : MdDelete}
          onClick={deleteChannel}
          destructive
        >
          <Switch fallback={<Trans>Delete channel</Trans>}>
            <Match when={props.channel.type === "Group"}>
              <Trans>Leave group</Trans>
            </Match>
          </Switch>
        </ContextMenuButton>
      </Show>

      <Show
        when={
          props.channel.server?.havePermission("ManageChannel") ||
          props.channel.havePermission("ManageChannel")
        }
      >
        <ContextMenuDivider />
      </Show>

      <ContextMenuButton icon={MdLink} onClick={copyLink}>
        <Trans>Copy link</Trans>
      </ContextMenuButton>
      <Show when={state.settings.getValue("advanced:copy_id")}>
        <ContextMenuButton icon={MdBadge} onClick={copyId}>
          <Trans>Copy channel ID</Trans>
        </ContextMenuButton>
      </Show>
      {/* server channels only: DMs and groups are reported via messages or members */}
      <Show when={props.channel.server && !props.channel.server.owner?.self}>
        <ContextMenuDivider />
        <ContextMenuButton icon={MdReport} onClick={report} destructive>
          <Trans>Report channel</Trans>
        </ContextMenuButton>
      </Show>
    </ContextMenu>
  );
}
