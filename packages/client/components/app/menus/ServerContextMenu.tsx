import { t } from "@lingui/core/macro";
import { folder as MdFolder } from "@revolt/ui/icons/legacy";
import { For, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import dayjs from "dayjs";
import { Server } from "@zrzur/sdk/solid";

import { canOpenServerSettings } from "@revolt/app/interface/settings/server/access";
import { useClient } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Column, Text, Time } from "@revolt/ui";

import {
  alternate_email as MdAlternateEmail,
  badge as MdBadge,
  bolt as MdBolt,
  campaign as MdCampaign,
  create_new_folder as MdCreateNewFolder,
  face as MdFace,
  folder_off as MdFolderOff,
  info as MdInfo,
  logout as MdLogout,
  mark_chat_read as MdMarkChatRead,
  notifications_active as MdNotificationsActive,
  notifications_off as MdNotificationsOff,
  person_add as MdPersonAdd,
  report as MdReport,
  settings as MdSettings,
} from "@revolt/ui/icons/legacy";

import {
  do_not_disturb_off as MdDoNotDisturbOff,
  do_not_disturb_on as MdDoNotDisturbOn,
  notification_settings as MdNotificationSettings,
  radio_button_checked as MdRadioButtonChecked,
  radio_button_unchecked as MdRadioButtonUnchecked,
} from "@revolt/ui/icons/legacy";

import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
  ContextMenuSubMenu,
} from "./ContextMenu";

/**
 * Context menu for servers
 */
export function ServerContextMenu(props: {
  server: Server;
  /**
   * When opened from the server header, offer the server info sheet
   */
  openServerInfo?: () => void;
}) {
  const state = useState();
  const client = useClient();
  const device = useDevice();
  const { openModal } = useModals();

  /**
   * Mark server as read
   */
  function markAsRead() {
    // a failed request is only a mark that comes back with the next sync
    props.server.ack().catch(() => undefined);
  }

  /**
   * Create a new invite
   */
  function createInvite() {
    // Find the first channel we can invite people to
    const channel = props.server.orderedChannels
      .find((category) =>
        category.channels.find((channel) =>
          channel.havePermission("InviteOthers"),
        ),
      )!
      .channels.find((channel) => channel.havePermission("InviteOthers"))!;

    openModal({
      type: "create_invite",
      channel,
    });
  }

  /**
   * Open server settings
   */
  function editIdentity() {
    openModal({
      type: "server_identity",
      member: props.server.member!,
    });
  }

  /**
   * Open server settings
   */
  function openSettings() {
    openModal({
      type: "settings",
      config: "server",
      context: props.server,
    });
  }

  /**
   * Report the server
   */
  function report() {
    openModal({
      type: "report_content",
      target: props.server,
      client: client(),
    });
  }

  /**
   * Open the supercharge sheet
   */
  function supercharge() {
    openModal({
      type: "supercharge_server",
      server: props.server,
    });
  }

  /**
   * Leave the server
   */
  function leave() {
    openModal({
      type: "leave_server",
      server: props.server,
    });
  }

  /**
   * Copy server id to clipboard
   */
  function copyId() {
    navigator.clipboard.writeText(props.server.id);
  }

  /**
   * Determine whether we can invite others to any channels
   */
  const permissionInviteOthers = () =>
    props.server.channels.find((channel) =>
      channel.havePermission("InviteOthers"),
    );

  /**
   * Determine whether we can edit our identity
   */
  const permissionEditIdentity = () =>
    props.server.havePermission("ChangeNickname") ||
    props.server.havePermission("ChangeAvatar");

  /**
   * Determine whether we can access settings
   */
  const permissionServerSettings = () => canOpenServerSettings(props.server);

  return (
    <ContextMenu>
      <Show when={props.openServerInfo}>
        <ContextMenuButton
          icon={MdInfo}
          onClick={() => props.openServerInfo!()}
        >
          <Trans>Server info</Trans>
        </ContextMenuButton>
        <ContextMenuDivider />
      </Show>
      <Show when={props.server.unread}>
        <ContextMenuButton icon={MdMarkChatRead} onClick={markAsRead}>
          <Trans>Mark as read</Trans>
        </ContextMenuButton>
        <ContextMenuDivider />
      </Show>

      {/* roles by interest: change your answers any time */}
      <Show
        when={props.server.lobby?.onboarding?.some((q) => q.options.length)}
      >
        <ContextMenuButton
          icon={MdFace}
          onClick={() => openModal({ type: "interests", server: props.server })}
        >
          <Trans>Your interests</Trans>
        </ContextMenuButton>
        <ContextMenuDivider />
      </Show>

      <Show when={billingAvailable()}>
        <ContextMenuButton icon={MdBolt} onClick={supercharge}>
          <Trans>Give Wings</Trans>
        </ContextMenuButton>
        <Show when={props.server.havePermission("ManageServer")}>
          <ContextMenuButton
            icon={MdCampaign}
            onClick={() =>
              openModal({ type: "promote_server", server: props.server })
            }
          >
            <Trans>Promote on Discover</Trans>
          </ContextMenuButton>
        </Show>
        <ContextMenuDivider />
      </Show>

      <Show
        when={!state.notifications.isMuted(props.server)}
        fallback={
          <ContextMenuButton
            onClick={() =>
              state.notifications.setServerMute(props.server, undefined)
            }
            symbol={MdDoNotDisturbOff}
            _titleCase={false}
          >
            <Column gap="none">
              <Trans>Unmute server</Trans>
              <Show
                when={state.notifications.getServerMute(props.server)?.until}
              >
                <Text class="label" size="small">
                  <Trans>
                    Muted until{" "}
                    <Time
                      format="datetime"
                      value={
                        state.notifications.getServerMute(props.server)!.until
                      }
                    />
                  </Trans>
                </Text>
              </Show>
            </Column>
          </ContextMenuButton>
        }
      >
        <ContextMenuSubMenu
          onClick={() => state.notifications.setServerMute(props.server, {})}
          buttonContent={<Trans>Mute server</Trans>}
          symbol={MdDoNotDisturbOn}
        >
          <For
            each={
              [
                [15, <Trans>For 15 minutes</Trans>],
                [60, <Trans>For 1 hour</Trans>],
                [180, <Trans>For 3 hours</Trans>],
                [480, <Trans>For 8 hours</Trans>],
                [1440, <Trans>For 24 hours</Trans>],
                [undefined, <Trans>Until I turn it back on</Trans>],
              ] as const
            }
          >
            {([timeMin, i18n]) => (
              <ContextMenuButton
                onClick={() =>
                  state.notifications.setServerMute(props.server, {
                    until: timeMin
                      ? +dayjs().add(timeMin, "minutes")
                      : undefined,
                  })
                }
                _titleCase={false}
              >
                {i18n}
              </ContextMenuButton>
            )}
          </For>
        </ContextMenuSubMenu>
      </Show>

      <ContextMenuSubMenu
        onClick={
          device.layout() === "desktop" && !device.isMobile && !device.hasTouch
            ? () =>
                state.ordering.createFolder(t`New folder`, [props.server.id])
            : undefined
        }
        icon={MdFolder}
        buttonContent={<Trans>Add to folder</Trans>}
      >
        <For each={state.ordering.folders()}>
          {(folder) => (
            <ContextMenuButton
              onClick={() =>
                state.ordering.addToFolder(folder.id, props.server.id)
              }
            >
              <Show when={folder.name} fallback={<Trans>Unnamed folder</Trans>}>
                {folder.name}
              </Show>
            </ContextMenuButton>
          )}
        </For>
        <ContextMenuButton
          icon={MdCreateNewFolder}
          onClick={() =>
            state.ordering.createFolder(t`New folder`, [props.server.id])
          }
        >
          <Trans>New folder</Trans>
        </ContextMenuButton>
      </ContextMenuSubMenu>

      <Show when={state.ordering.folderOf(props.server.id)}>
        <ContextMenuButton
          icon={MdFolderOff}
          onClick={() => state.ordering.removeFromFolder(props.server.id)}
        >
          <Trans>Remove from folder</Trans>
        </ContextMenuButton>
      </Show>

      <ContextMenuDivider />

      <ContextMenuSubMenu
        symbol={MdNotificationSettings}
        buttonContent={<Trans>Notifications</Trans>}
      >
        <ContextMenuButton
          icon={MdNotificationsActive}
          onClick={() => state.notifications.setServer(props.server, "all")}
          actionSymbol={
            state.notifications.computeForServer(props.server) === "all"
              ? MdRadioButtonChecked
              : MdRadioButtonUnchecked
          }
        >
          <Trans>All messages</Trans>
        </ContextMenuButton>
        <ContextMenuButton
          icon={MdAlternateEmail}
          onClick={() => state.notifications.setServer(props.server, "mention")}
          actionSymbol={
            state.notifications.computeForServer(props.server) === "mention"
              ? MdRadioButtonChecked
              : MdRadioButtonUnchecked
          }
        >
          <Trans>Mentions only</Trans>
        </ContextMenuButton>
        <ContextMenuButton
          icon={MdNotificationsOff}
          onClick={() => state.notifications.setServer(props.server, "none")}
          actionSymbol={
            state.notifications.computeForServer(props.server) === "none"
              ? MdRadioButtonChecked
              : MdRadioButtonUnchecked
          }
        >
          <Trans>None</Trans>
        </ContextMenuButton>
      </ContextMenuSubMenu>
      <ContextMenuDivider />

      <Show when={permissionInviteOthers()}>
        <ContextMenuButton icon={MdPersonAdd} onClick={createInvite}>
          <Trans>Create invite</Trans>
        </ContextMenuButton>
      </Show>
      <Show when={permissionEditIdentity()}>
        <ContextMenuButton icon={MdFace} onClick={editIdentity}>
          <Trans>Edit your identity</Trans>
        </ContextMenuButton>
      </Show>
      <Show when={permissionServerSettings()}>
        <ContextMenuButton icon={MdSettings} onClick={openSettings}>
          <Trans>Open server settings</Trans>
        </ContextMenuButton>
      </Show>
      <Show
        when={
          permissionInviteOthers() ||
          permissionEditIdentity() ||
          permissionServerSettings()
        }
      >
        <ContextMenuDivider />
      </Show>

      <ContextMenuButton icon={MdReport} onClick={report} destructive>
        <Trans>Report server</Trans>
      </ContextMenuButton>
      <Show when={!props.server.owner?.self}>
        <ContextMenuButton icon={MdLogout} onClick={leave} destructive>
          <Trans>Leave server</Trans>
        </ContextMenuButton>
      </Show>

      <Show when={state.settings.getValue("advanced:copy_id")}>
        <ContextMenuButton icon={MdBadge} onClick={copyId}>
          <Trans>Copy server ID</Trans>
        </ContextMenuButton>
      </Show>
    </ContextMenu>
  );
}
