import { t } from "@lingui/core/macro";
import { folder as MdFolder } from "@revolt/ui/icons/legacy";
import { For, Show } from "solid-js";

import { Plural, Trans } from "@lingui/solid/macro";
import { Channel, Server } from "@zrzur/sdk/solid";
import dayjs from "dayjs";

import { canOpenServerSettings } from "@revolt/app/interface/settings/server/access";
import { useClient } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar, Column, Text, Time } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { styled } from "styled-system/jsx";

import {
  markServerRead,
  serverHasNews,
} from "../../../src/interface/channels/forum/unread";
import Breakpoint from "../../common/Breakpoint";
import { QuickAction, QuickRow } from "./shared/QuickRow";

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
import { SuppressMentionsMenuItems } from "./shared/SuppressMentionsMenuItems";

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
  const isMuted = (channel: Channel) => state.notifications.isMuted(channel);
  const device = useDevice();
  const { openModal, showError } = useModals();
  const navigate = useNavigate();

  /** The ticket this user has open in the server, if any */
  const myTicket = () => {
    const me = client().user?.id;
    return props.server.channels.find(
      (channel) =>
        channel.ticket?.openerId === me && channel.ticket?.closed === false,
    );
  };

  /**
   * Open a ticket with the server's staff, or go to the one already open
   */
  async function openTicket() {
    const go = (channelId: string) => {
      navigate(`/server/${props.server.id}/channel/${channelId}`);
      // phones: like a channel, opening it slides the channel list away
      state.appDrawer()?.setShown(true);
    };
    const ticket = myTicket();
    if (ticket) return go(ticket.id);
    // a server with kinds of ticket asks which one first
    if (props.server.tickets?.types.length) {
      state.appDrawer()?.setShown(true);
      return openModal({ type: "open_ticket", server: props.server });
    }
    try {
      go((await props.server.openTicket()).id);
    } catch (error) {
      showError(error);
    }
  }

  /**
   * Mark server as read
   */
  function markAsRead() {
    // forums too: their posts are not in the server's channel list
    void markServerRead(client(), props.server, isMuted);
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

  /**
   * Phones show this menu as a bottom sheet (FloatingManager, same query):
   * it starts with the server itself and the three things people open it
   * for, as large buttons; the rows below are everything else.
   */
  const sheet =
    typeof window !== "undefined" &&
    !!window.matchMedia?.(Breakpoint.phone).matches;

  return (
    <ContextMenu>
      <Show when={sheet}>
        <SheetHead data-server-sheet-head>
          <SheetHeadIcon>
            <Avatar
              size={56}
              shape="rounded-square"
              src={props.server.animatedIconURL ?? props.server.iconURL}
              fallback={props.server.name}
            />
          </SheetHeadIcon>
          <SheetHeadText>
            <strong dir="auto">{props.server.name}</strong>
            <Show when={props.server.approximateMemberCount}>
              <small>
                <Plural
                  value={props.server.approximateMemberCount}
                  one="# member"
                  other="# members"
                />
              </small>
            </Show>
          </SheetHeadText>
        </SheetHead>
        <QuickRow role="group" data-quick-actions>
          <Show when={permissionInviteOthers()}>
            <QuickAction
              role="menuitem"
              tabIndex={0}
              aria-label={t`Create invite`}
              onClick={createInvite}
            >
              <Icon name="user-plus" size={22} />
              <span>
                <Trans>Invite</Trans>
              </span>
            </QuickAction>
          </Show>
          <Show when={props.openServerInfo}>
            <QuickAction
              role="menuitem"
              tabIndex={0}
              aria-label={t`Server info`}
              onClick={() => props.openServerInfo!()}
            >
              <Icon name="info" size={22} />
              <span>
                <Trans>Server info</Trans>
              </span>
            </QuickAction>
          </Show>
          <Show when={permissionServerSettings()}>
            <QuickAction
              role="menuitem"
              tabIndex={0}
              aria-label={t`Open server settings`}
              onClick={openSettings}
            >
              <Icon name="gear-six" size={22} />
              <span>
                <Trans>Settings</Trans>
              </span>
            </QuickAction>
          </Show>
        </QuickRow>
        <ContextMenuDivider />
      </Show>
      <Show when={props.openServerInfo && !sheet}>
        <ContextMenuButton
          icon={MdInfo}
          onClick={() => props.openServerInfo!()}
        >
          <Trans>Server info</Trans>
        </ContextMenuButton>
        <ContextMenuDivider />
      </Show>
      <Show when={serverHasNews(client(), props.server, isMuted)}>
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
          onClick={() => state.notifications.setServer(props.server, undefined)}
          actionSymbol={
            typeof state.notifications.getServer(props.server) === "undefined"
              ? MdRadioButtonChecked
              : MdRadioButtonUnchecked
          }
          _titleCase={false}
        >
          <Column gap="none">
            <Trans>Server default</Trans>
            <Text class="label" size="small">
              <Show
                when={props.server.defaultNotifications === "All"}
                fallback={<Trans>Mentions only</Trans>}
              >
                <Trans>All messages</Trans>
              </Show>
            </Text>
          </Column>
        </ContextMenuButton>
        <ContextMenuButton
          icon={MdNotificationsActive}
          onClick={() => state.notifications.setServer(props.server, "all")}
          actionSymbol={
            state.notifications.getServer(props.server) === "all"
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
            state.notifications.getServer(props.server) === "mention"
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
            state.notifications.getServer(props.server) === "none"
              ? MdRadioButtonChecked
              : MdRadioButtonUnchecked
          }
        >
          <Trans>None</Trans>
        </ContextMenuButton>
        <ContextMenuDivider />
        <SuppressMentionsMenuItems target={props.server} />
      </ContextMenuSubMenu>
      <ContextMenuDivider />

      <Show when={props.server.tickets?.enabled === true}>
        <ContextMenuButton
          icon={<Icon name="ticket" size={20} />}
          data-testid="ticket-entry"
          onClick={() => void openTicket()}
        >
          <Show
            when={myTicket()}
            fallback={props.server.tickets?.label || t`Open a ticket`}
          >
            <Trans>Your ticket</Trans>
          </Show>
        </ContextMenuButton>
        <ContextMenuDivider />
      </Show>
      <Show when={permissionInviteOthers() && !sheet}>
        <ContextMenuButton icon={MdPersonAdd} onClick={createInvite}>
          <Trans>Create invite</Trans>
        </ContextMenuButton>
      </Show>
      <Show when={permissionEditIdentity()}>
        <ContextMenuButton icon={MdFace} onClick={editIdentity}>
          <Trans>Edit your identity</Trans>
        </ContextMenuButton>
      </Show>
      <Show when={permissionServerSettings() && !sheet}>
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

/** Phone sheet: the server this sheet is about */
const SheetHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "0 2px 14px",
  },
});

/** A server without a picture shows its initials: on a tile, as on the rail */
const SheetHeadIcon = styled("span", {
  base: {
    flex: "none",
    width: "56px",
    height: "56px",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: "16px",
    background: "var(--z-bg-frame)",
    boxShadow: "inset 0 0 0 1px var(--z-border-subtle)",
  },
});

const SheetHeadText = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "& strong": {
      fontSize: "18px",
      fontWeight: 700,
      lineHeight: "24px",
      color: "var(--z-fg-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& small": {
      fontSize: "13px",
      lineHeight: "18px",
      color: "var(--z-fg-muted)",
    },
  },
});
