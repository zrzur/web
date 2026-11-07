import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { Channel, Server } from "@zrzur/sdk/solid";

import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";

import {
  badge as MdBadge,
  delete as MdDelete,
  library_add as MdLibraryAdd,
  mark_chat_read as MdMarkChatRead,
} from "@revolt/ui/icons/legacy";

import { Symbol } from "@revolt/ui/components/utils/Symbol";
import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "./ContextMenu";

export type CategoryData = Omit<API.Category, "channels"> & {
  channels: Channel[];
};

/**
 * Context menu for categories
 */
export function CategoryContextMenu(props: {
  server: Server;
  category: CategoryData;
}) {
  const state = useState();
  const { openModal } = useModals();

  /**
   * Mark category as read
   */
  function markAsRead() {
    props.category.channels
      .filter((channel) => channel.unread || channel.mentions?.size)
      .forEach((channel) => channel.ack());
  }

  /**
   * Create a new channel
   */
  function createChannel() {
    openModal({
      type: "create_channel",
      server: props.server,
      categoryId: props.category.id,
    });
  }

  /**
   * Create a new category
   */
  function createCategory() {
    openModal({
      type: "create_category",
      server: props.server,
    });
  }

  /**
   * Delete category
   */
  function deleteCategory() {
    openModal({
      type: "delete_category",
      server: props.server,
      categoryId: props.category.id,
    });
  }

  function editPermissions() {
    openModal({
      type: "category_permissions",
      server: props.server,
      category: props.category,
    });
  }

  function editCategoryName() {
    openModal({
      type: "edit_category",
      server: props.server,
      category: props.category,
    });
  }

  /**
   * Copy category id to clipboard
   */
  function copyId() {
    navigator.clipboard.writeText(props.category.id);
  }

  /**
   * Determine if any channel in category has unread messages or pending mentions
   */
  const hasUnread = () => {
    return props.category.channels.some(
      (channel) => channel?.unread || channel?.mentions?.size,
    );
  };

  /** Whether this is a category saved on the server */
  const stored = () =>
    props.category.id !== "default" &&
    !!props.server.categories?.some((c) => c.id === props.category.id);

  return (
    <ContextMenu>
      <Show when={hasUnread()}>
        <ContextMenuButton icon={MdMarkChatRead} onClick={markAsRead}>
          <Trans>Mark as read</Trans>
        </ContextMenuButton>
        <ContextMenuDivider />
      </Show>

      <Show when={props.server.havePermission("ManageChannel")}>
        <ContextMenuButton icon={MdLibraryAdd} onClick={createChannel}>
          <Trans>Create channel</Trans>
        </ContextMenuButton>
        <ContextMenuButton icon={MdLibraryAdd} onClick={createCategory}>
          <Trans>Create category</Trans>
        </ContextMenuButton>
        {/* the built-in "Text channels" / "Voice channels" groups are not
            stored categories: nothing to rename or delete */}
        <Show when={stored()}>
          <ContextMenuButton
            icon={<Symbol size={16}>edit</Symbol>}
            onClick={editCategoryName}
          >
            <Trans>Rename category</Trans>
          </ContextMenuButton>
          <ContextMenuButton
            icon={MdDelete}
            onClick={deleteCategory}
            destructive
          >
            <Trans>Delete category</Trans>
          </ContextMenuButton>
        </Show>
      </Show>

      <Show when={stored() && props.server.havePermission("ManagePermissions")}>
        <ContextMenuButton
          icon={<Symbol size={16}>lock</Symbol>}
          onClick={editPermissions}
        >
          <Trans>Edit permissions</Trans>
        </ContextMenuButton>
      </Show>

      <Show when={stored() && state.settings.getValue("advanced:copy_id")}>
        <ContextMenuDivider />
      </Show>

      <Show when={stored() && state.settings.getValue("advanced:copy_id")}>
        <ContextMenuButton icon={MdBadge} onClick={copyId}>
          <Trans>Copy category ID</Trans>
        </ContextMenuButton>
      </Show>
    </ContextMenu>
  );
}
