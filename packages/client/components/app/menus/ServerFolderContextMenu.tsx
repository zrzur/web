import { Trans } from "@lingui/solid/macro";

import { useModals } from "@revolt/modal";
import { ServerFolder, useState } from "@revolt/state";

import {
  delete as MdDelete,
  drive_file_rename_outline as MdDriveFileRenameOutline,
} from "@revolt/ui/icons/legacy";

import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "./ContextMenu";

/**
 * Context menu for server folders
 */
export function ServerFolderContextMenu(props: { folder: ServerFolder }) {
  const state = useState();
  const { openModal } = useModals();

  /**
   * Rename the folder
   */
  function rename() {
    openModal({
      type: "edit_server_folder",
      folder: props.folder,
    });
  }

  /**
   * Remove the folder, keeping its servers
   */
  function remove() {
    state.ordering.deleteFolder(props.folder.id);
  }

  return (
    <ContextMenu>
      <ContextMenuButton icon={MdDriveFileRenameOutline} onClick={rename}>
        <Trans>Edit folder</Trans>
      </ContextMenuButton>
      <ContextMenuDivider />
      <ContextMenuButton icon={MdDelete} destructive onClick={remove}>
        <Trans>Delete folder</Trans>
      </ContextMenuButton>
    </ContextMenu>
  );
}
