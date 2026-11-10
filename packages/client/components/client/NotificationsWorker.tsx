import { createEffect, onCleanup, onMount } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import {
  ChannelEditSystemMessage,
  ChannelOwnershipChangeSystemMessage,
  ChannelRenamedSystemMessage,
  Message,
  MessagePinnedSystemMessage,
  TextSystemMessage,
  UserModeratedSystemMessage,
  UserSystemMessage,
} from "@zrzur/sdk/solid";

import { notificationPolicy } from "@revolt/plugins/registry";
import { useNavigate, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { notificationPreviewAllowed } from "@revolt/state/streamer";

import { useClient, useNotifications, useSound } from ".";
import { skipDesktopNotification } from "./notificationRules";

/**
 * Process and display desktop notifications
 */
export function NotificationsWorker() {
  const state = useState();
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const params = useSmartParams();
  const sound = useSound();

  const { initNotifications } = useNotifications();

  /**
   * Handle incoming messages
   * @param message Message
   */
  function onMessage(message: Message) {
    const us = client().user!;

    // Ignore our own messages (from any device) and the channel being read
    if (
      skipDesktopNotification({
        selfId: us?.id,
        authorId: message.authorId,
        channelId: message.channelId,
        viewingChannelId: params().channelId,
        focused: document.hasFocus(),
        visible: document.visibilityState === "visible",
      })
    )
      return;

    // Ignore blocked users
    if (message.author?.relationship === "Blocked") return;

    // Ignore muted channels
    if (state.notifications.isMuted(message.channel)) return;

    // a mention after the reader's suppress options (@everyone, roles)
    const mentioned = state.notifications.mentionsForNotification(
      message,
      us?.id,
    );

    // Check channel notification settings
    switch (state.notifications.computeForChannel(message.channel!)) {
      case "none":
        return; // ignore if muted/none
      case "mention":
        if (!mentioned) return; // ignore if not mentioned
    }

    // Ignore if we're busy or focused
    if (
      us.status?.presence === "Busy" ||
      (us.status?.presence === "Focus" && !mentioned)
    )
      return;

    // Generate the title
    let title;
    switch (message.channel!.type) {
      case "SavedMessages":
        return;
      case "DirectMessage":
        title = `@${message.username}`;
        break;
      case "Group":
        if (message.author?.id === "00000000000000000000000000") {
          title = message.channel?.name;
        } else {
          title = `@${message.username} - ${message.channel?.name}`;
        }
        break;
      case "TextChannel":
        title = `@${message.username} (#${message.channel?.name}, ${message.channel?.server?.name})`;
        break;
    }

    // Find image if applicable
    const image = message.attachments?.find(
      (x) => x.metadata.type === "Image",
    )?.previewUrl;

    // Find body/icon
    let body, icon;
    if (message.content) {
      body = message.contentPlain;
      icon = message.avatarURL;
    } else if (message.systemMessage) {
      switch (message.systemMessage.type) {
        case "text":
          body = (message.systemMessage as TextSystemMessage).content;
          break;
        case "user_added":
          body = t`${
            (message.systemMessage as UserModeratedSystemMessage).user?.username
          } was added by ${
            (message.systemMessage as UserModeratedSystemMessage).by?.username
          }`;
          icon = (message.systemMessage as UserModeratedSystemMessage).user
            ?.avatarURL;
          break;
        case "user_remove":
          body = t`${
            (message.systemMessage as UserModeratedSystemMessage).user?.username
          } was removed by ${
            (message.systemMessage as UserModeratedSystemMessage).by?.username
          }`;
          icon = (message.systemMessage as UserModeratedSystemMessage).user
            ?.avatarURL;
          break;
        case "user_joined":
          body = t`${
            (message.systemMessage as UserSystemMessage).user?.username
          } joined`;
          icon = (message.systemMessage as UserSystemMessage).user?.avatarURL;
          break;
        case "user_left":
          body = t`${
            (message.systemMessage as UserSystemMessage).user?.username
          } left`;
          icon = (message.systemMessage as UserSystemMessage).user?.avatarURL;
          break;
        case "user_kicked":
          body = t`${
            (message.systemMessage as UserSystemMessage).user?.username
          } was kicked`;
          icon = (message.systemMessage as UserSystemMessage).user?.avatarURL;
          break;
        case "user_banned":
          body = t`${
            (message.systemMessage as UserSystemMessage).user?.username
          } was banned`;
          icon = (message.systemMessage as UserSystemMessage).user?.avatarURL;
          break;
        case "channel_renamed":
          body = t`${
            (message.systemMessage as ChannelRenamedSystemMessage).by?.username
          } renamed the channel`;
          icon = (message.systemMessage as ChannelRenamedSystemMessage).by
            ?.avatarURL;
          break;
        case "channel_description_changed":
          body = t`${
            (message.systemMessage as ChannelEditSystemMessage).by?.username
          } changed the channel description`;
          icon = (message.systemMessage as ChannelEditSystemMessage).by
            ?.avatarURL;
          break;
        case "channel_icon_changed":
          body = t`${
            (message.systemMessage as ChannelEditSystemMessage).by?.username
          } changed the channel icon`;
          icon = (message.systemMessage as ChannelEditSystemMessage).by
            ?.avatarURL;
          break;
        case "channel_ownership_changed":
          body = t`${
            (message.systemMessage as ChannelOwnershipChangeSystemMessage).from
              ?.username
          } made ${
            (message.systemMessage as ChannelOwnershipChangeSystemMessage).to
              ?.username
          } the new group owner`;
          icon = (message.systemMessage as ChannelOwnershipChangeSystemMessage)
            .from?.avatarURL;
          break;
        case "message_pinned":
          body = t`${
            (message.systemMessage as MessagePinnedSystemMessage).by?.username
          } pinned a message`;
          icon = (message.systemMessage as MessagePinnedSystemMessage).by
            ?.avatarURL;
          break;
        case "message_unpinned":
          body = t`${
            (message.systemMessage as MessagePinnedSystemMessage).by?.username
          } unpinned a message`;
          icon = (message.systemMessage as MessagePinnedSystemMessage).by
            ?.avatarURL;
          break;
      }
    } else if (message.attachments?.length) {
      body = t`Sent ${message.attachments!.length} attachments`;
    }

    // Don't continue if we don't have notification permissions
    if (
      Notification.permission !== "granted" ||
      state.settings.desktopNotificationsState !== "allowed"
    )
      return;

    // plugins with notifications.display only set rules (quiet hours,
    // hidden previews, muted sound); they never see the notification
    const policy = notificationPolicy();
    if (policy.suppress) return;
    if (!policy.muteSound) sound.playSound("message");

    // streamer mode keeps DM and group messages off the screen
    const hidePreview =
      policy.hidePreview ||
      !notificationPreviewAllowed(
        state.settings.streamerMode,
        message.channel?.type,
      );

    const notification = new Notification(title!, {
      icon,
      // @ts-expect-error this does exist on some platforms
      image: hidePreview ? undefined : image,
      body: hidePreview ? t`New message` : body,
      timestamp: message.createdAt,
      tag: message.channelId,
      badge: "/assets/web/zrzur-pwa-512.png",
      silent: true,
    });

    notification.addEventListener("click", () => {
      window.focus();
      navigate(message.path);
    });
  }

  createEffect(() => {
    client().addListener("messageCreate", onMessage);
    onCleanup(() => client().removeListener("messageCreate", onMessage));
  });

  /**
   * Handle page click to request notifications
   */
  function tryRequest() {
    document.removeEventListener("click", tryRequest);

    initNotifications();
  }

  onMount(() => {
    document.addEventListener("click", tryRequest);
  });

  onCleanup(() => document.removeEventListener("click", tryRequest));

  return null;
}
