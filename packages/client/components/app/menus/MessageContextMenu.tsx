import { Accessor, For, Match, Show, Switch } from "solid-js";

import {
  File,
  ImageEmbed,
  Message,
  VideoEmbed,
  WebsiteEmbed,
} from "@zrzur/sdk/solid";

import {
  canSend,
  startAccess,
  threadIsReadOnly,
} from "@revolt/app/interface/channels/threadAccess";
import { useClient, useUser } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { CustomEmoji, UnicodeEmoji } from "@revolt/markdown/emoji";
import { useModals } from "@revolt/modal";
import {
  canForwardMessage,
  forwardingEnabled,
} from "@revolt/modal/modals/forwardTargets";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { MediaPickerProps } from "@revolt/ui/components/features/messaging/composition/picker/CompositionMediaPicker";

import {
  badge as MdBadge,
  content_copy as MdContentCopy,
  delete as MdDelete,
  delete_sweep as MdDeleteSweep,
  download as MdDownload,
  edit as MdEdit,
  emoji_emotions as MdEmojiEmotions,
  forward as MdForward,
  link as MdLink,
  mark_chat_unread as MdMarkChatUnread,
  open_in_new as MdOpenInNew,
  pin_invoke as MdPin,
  reply as MdReply,
  report as MdReport,
} from "@revolt/ui/icons/legacy";

import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Emoji } from "@revolt/markdown";
import { pluginsEnabled } from "@revolt/plugins/enabled";
import {
  hostHooks as pluginHooks,
  messageActions as pluginMessageActions,
} from "@revolt/plugins/registry";
import { useSnackbar } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import {
  apps as MdApps,
  sentiment_content as MdSentimentContent,
} from "@revolt/ui/icons/legacy";

import Breakpoint from "../../common/Breakpoint";
import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
  ContextMenuSubMenu,
} from "./ContextMenu";

import { editableByMe } from "@revolt/app/interface/channels/text/editable";
import { canRemoveLinkPreviews } from "@revolt/app/interface/channels/text/linkPreviews";
import { canEndPoll } from "@revolt/app/interface/channels/text/poll/pollModel";

import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";

// bot commands in the menu: loaded when a menu first opens, not with the app
const AppsSubMenu = lazyRetry(
  () =>
    import("./shared/AppsSubMenu").then((m) => ({ default: m.AppsSubMenu })),
  () => null,
);
import { SelectMessagesMenuItem } from "./shared/SelectMessagesMenuItem";

/**
 * Context menu for messages
 */
export function MessageContextMenu(props: {
  message?: Message;
  reactPicker?: Accessor<MediaPickerProps | undefined>;
  file?: File | ImageEmbed | VideoEmbed | WebsiteEmbed;
  link?: string;
}) {
  const user = useUser();
  const state = useState();
  const instance = useInstance();
  const client = useClient();
  const snackbar = useSnackbar();
  const { t } = useLingui();
  const { openModal, showError } = useModals();
  const navigate = useNavigate();

  /**
   * Reply to this message
   */
  function reply() {
    state.draft.addReply(props.message!, user()!.id);
  }

  /**
   * Forward a copy of this message somewhere else
   */
  function forward() {
    openModal({ type: "forward_message", message: props.message! });
  }

  /**
   * Start a thread from this message, named after its first words
   */
  function startThread() {
    const words = (props.message!.content ?? "").trim().replace(/\s+/g, " ");
    openModal({
      type: "create_thread",
      channel: props.message!.channel!,
      message: props.message!,
      name: words.length > 60 ? `${words.slice(0, 60)}…` : words,
    });
  }

  /**
   * Mark message as unread
   */
  function markAsUnread() {
    props.message!.ack(true, false, true);
  }

  /**
   * Copy message contents to clipboard
   */
  function copyText() {
    navigator.clipboard.writeText(props.message!.content);
  }

  /**
   * Report the message
   */
  function report() {
    openModal({
      type: "report_content",
      target: props.message!,
      client: client(),
    });
  }

  /**
   * Report the attachment that was right-clicked
   */
  function reportFile() {
    const file = props.file as File;
    openModal({
      type: "report_content",
      client: client(),
      target: {
        kind: "Attachment",
        id: file.id,
        messageId: props.message!.id,
        label: file.filename,
      },
    });
  }

  /**
   * Report the webhook that sent this message
   */
  function reportWebhook() {
    openModal({
      type: "report_content",
      client: client(),
      target: {
        kind: "Webhook",
        id: props.message!.authorId!,
        messageId: props.message!.id,
        label: props.message!.webhook?.name,
      },
    });
  }

  /**
   * Delete the message
   */
  function deleteMessage(ev: MouseEvent) {
    if (ev.shiftKey) {
      props.message!.delete();
    } else {
      openModal({
        type: "delete_message",
        message: props.message!,
      });
    }
  }

  /**
   * Remove the message's link previews for everyone (asks first; Shift skips)
   */
  function removePreviews(ev: MouseEvent) {
    if (ev.shiftKey) {
      props.message!.removeEmbeds().catch(showError);
    } else {
      openModal({
        type: "remove_link_previews",
        message: props.message!,
      });
    }
  }

  /**
   * Pin/unpin the message
   */
  function pinMessage(ev: MouseEvent) {
    if (ev.shiftKey) {
      if (props.message!.pinned) {
        props.message!.unpin().catch(showError);
      } else {
        props.message!.pin().catch(showError);
      }
    } else {
      openModal({
        type: "pin_message",
        message: props.message!,
      });
    }
  }

  /**
   * Copy message link to clipboard
   */
  function copyMessageLink() {
    navigator.clipboard.writeText(
      instance.href(
        `${
          props.message!.server ? `/server/${props.message!.server?.id}` : ""
        }/channel/${props.message!.channelId}/${props.message!.id}`,
      ),
    );
  }

  /**
   * Copy message id to clipboard
   */
  function copyId() {
    navigator.clipboard.writeText(props.message!.id);
  }

  /**
   * Opens the file preview in a new tab
   */
  function openFile() {
    window.open(getFileUrl(), "_blank", "noopener,noreferrer");
  }

  /**
   * Copies the link to the original url of the file
   */
  function copyFileLink() {
    navigator.clipboard.writeText(getFileUrl());
  }

  /**
   * Write a blob to the navigator clipboard
   * @param [type] - The blob's MIME type, optional
   */
  async function writeBlobToClipboard(blob: Blob | null, type?: string) {
    if (!blob) throw new Error("Can't write nothing to the clipboard");

    await navigator.clipboard.write([
      new ClipboardItem({
        // Workaround for the clipboard API being extremely picky
        // https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api
        [type ?? blob.type]: blob,
      }),
    ]);

    snackbar.show({ message: t`Copied file to clipboard` });
  }

  /**
   * Download the file from `url` and insert it to the user's clipboard
   */
  async function copyFile(url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`Failed to download file: ${res.statusText}.`);

      const blob = await res.blob();
      if (ClipboardItem.supports(blob.type)) {
        await writeBlobToClipboard(blob);
      } else {
        if (blob.type.startsWith("image/")) {
          // Naively convert to PNG
          const c = document.createElement("canvas"),
            ctx = c.getContext("2d"),
            img = new Image();

          img.onload = () => {
            c.width = img.width;
            c.height = img.height;
            ctx!.drawImage(img, 0, 0);
            URL.revokeObjectURL(img.src);
            c.toBlob(async (b) => {
              try {
                await writeBlobToClipboard(b, "image/png");
              } catch (error) {
                showError(error);
              }
            }, "image/png");
          };

          img.onerror = showError;
          img.src = URL.createObjectURL(blob);
        } else {
          // Workaround for copying unsupported formats to the clipboard
          // See: https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api
          await writeBlobToClipboard(blob, `web ${blob.type}`);
        }
      }
    } catch (error) {
      showError(error);
    }
  }

  /**
   * Get the preview URL of a file or embed.
   */
  function getFileUrl(): string {
    let url: string = "";

    if (props.file instanceof File) {
      url = props.file.previewUrl;
    } else if (
      props.file instanceof ImageEmbed ||
      props.file instanceof VideoEmbed ||
      (props.file instanceof WebsiteEmbed &&
        props.file.specialContent?.type === "GIF")
    ) {
      url = props.file.url!;
    }

    return url;
  }

  function copyLink() {
    navigator.clipboard.writeText(props.link ?? "");
  }

  /**
   * Phones show this menu as a bottom sheet (FloatingManager, same query).
   * There the four things done most (reply, react, copy, delete) are a row
   * of large buttons at the top instead of four rows spread over the list:
   * Delete was the eleventh row, at the far end of the sheet.
   */
  const quick = () =>
    !!props.message &&
    typeof window !== "undefined" &&
    !!window.matchMedia?.(Breakpoint.phone).matches;

  /** official messages are read, copied and marked as unread, nothing else */
  const official = () => !!props.message?.author?.official;

  // permission rules (unchanged), named so groups/dividers can use them
  const canReply = () =>
    !official() && !!props.message?.channel && canSend(props.message.channel);
  const canReact = () =>
    !official() &&
    !!props.reactPicker &&
    !!props.message?.channel?.havePermission("React") &&
    !threadIsReadOnly(props.message.channel);
  /** a thread can start from a message of a text channel (not a thread) */
  const canThread = () => {
    const channel = props.message?.channel;
    return (
      !official() &&
      channel?.type === "TextChannel" &&
      !channel.isVoice &&
      !channel.isThread &&
      !channel.isForum &&
      startAccess(channel) === "allowed"
    );
  };
  const existingThread = () =>
    props.message?.channel?.threadOf(props.message.id);
  const canForward = () =>
    !official() &&
    !!props.message &&
    forwardingEnabled(client()) &&
    canForwardMessage(props.message);
  const canEdit = () =>
    !!props.message && editableByMe(props.message) && canReply();
  /** the author ends their own open poll, Manage Messages anyone's */
  const canEndThisPoll = () =>
    !!props.message?.poll &&
    canEndPoll({
      author: !!props.message.author?.self,
      manage: !!props.message.channel?.havePermission("ManageMessages"),
      closed: props.message.isPollClosed(),
    });
  const canPin = () =>
    !official() &&
    (props.message?.channel?.type === "DirectMessage" ||
      !!props.message?.channel?.havePermission("ManageMessages"));
  const canRemovePreviews = () =>
    !!props.message && canRemoveLinkPreviews(props.message);
  const canManageReactions = () =>
    !!props.message?.reactions.size &&
    !!props.message?.channel?.havePermission("ManageMessages");
  const canDelete = () =>
    !!props.message?.author?.self ||
    !!props.message?.channel?.havePermission("ManageMessages");
  const canReport = () =>
    !props.message?.author?.self &&
    !props.message?.systemMessage &&
    !official();

  return (
    <ContextMenu>
      <Show when={props.file}>
        <ContextMenuButton icon={MdOpenInNew} onClick={openFile}>
          <Trans>Open file</Trans>
        </ContextMenuButton>
        <ContextMenuButton icon={MdLink} onClick={copyFileLink}>
          <Trans>Copy link to file</Trans>
        </ContextMenuButton>
        <Show when={props.file instanceof File}>
          <a
            target="_blank"
            rel="noopener noreferrer"
            download={(props.file as File)?.filename}
            href={(props.file as File)?.originalUrl}
          >
            <ContextMenuButton icon={MdDownload}>
              <Trans>Save file</Trans>
            </ContextMenuButton>
          </a>
          <ContextMenuButton
            icon={MdContentCopy}
            onClick={() => copyFile((props.file as File)!.originalUrl)}
          >
            <Trans>Copy file</Trans>
          </ContextMenuButton>
        </Show>

        <Show when={props.link || props.message}>
          <ContextMenuDivider />
        </Show>
      </Show>
      <Show when={props.link}>
        <ContextMenuButton icon={MdLink} onClick={copyLink}>
          <Trans>Copy link</Trans>
        </ContextMenuButton>

        <ContextMenuDivider />
      </Show>
      <Show when={props.message}>
        {/* phones: what people do most, one tap away, before the list */}
        <Show when={quick()}>
          {/* a reaction in one tap: six to start from, the last opens them all */}
          <Show when={canReact()}>
            <ReactRow role="group" data-quick-reactions>
              <For each={QUICK_REACTIONS}>
                {(emoji) => (
                  <ReactTile
                    role="menuitem"
                    tabIndex={0}
                    aria-label={emoji}
                    onClick={() => void props.message!.react(emoji)}
                  >
                    <Emoji emoji={emoji} />
                  </ReactTile>
                )}
              </For>
              <ReactTile
                role="menuitem"
                tabIndex={0}
                aria-label={t`React`}
                onClick={(e) => props.reactPicker!()?.onClickEmoji(e)}
              >
                <Icon name="smiley" size={22} />
              </ReactTile>
            </ReactRow>
          </Show>
          <QuickRow role="group" data-quick-actions>
            <Show when={canReply()}>
              <QuickAction
                role="menuitem"
                tabIndex={0}
                aria-label={t`Reply`}
                onClick={reply}
              >
                <Icon name="arrow-bend-up-left" size={22} />
                <span>
                  <Trans>Reply</Trans>
                </span>
              </QuickAction>
            </Show>
            <Show when={canForward()}>
              <QuickAction
                role="menuitem"
                tabIndex={0}
                aria-label={t`Forward`}
                onClick={forward}
              >
                <Icon name="arrow-bend-up-right" size={22} />
                <span>
                  <Trans>Forward</Trans>
                </span>
              </QuickAction>
            </Show>
            <QuickAction
              role="menuitem"
              tabIndex={0}
              aria-label={t`Copy text`}
              onClick={copyText}
            >
              <Icon name="copy" size={22} />
              <span>
                <Trans>Copy</Trans>
              </span>
            </QuickAction>
            <Show when={canDelete()}>
              <QuickAction
                role="menuitem"
                tabIndex={0}
                data-danger
                aria-label={t`Delete message`}
                onClick={deleteMessage}
              >
                <Icon name="trash" size={22} />
                <span>
                  <Trans>Delete</Trans>
                </span>
              </QuickAction>
            </Show>
          </QuickRow>
          <ContextMenuDivider />
        </Show>
        {/* 1 · interact */}
        <Show when={canReact() && !quick()}>
          <ContextMenuButton
            icon={MdEmojiEmotions}
            onClick={(e) => props.reactPicker!()?.onClickEmoji(e)}
          >
            <Trans>React</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={canReply() && !quick()}>
          <ContextMenuButton icon={MdReply} onClick={reply}>
            <Trans>Reply</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={canForward() && !quick()}>
          <ContextMenuButton icon={MdForward} onClick={forward}>
            <Trans>Forward</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={canThread() || existingThread()}>
          <Show
            when={existingThread()}
            fallback={
              <ContextMenuButton
                icon={<Icon name="chat-circle" size={16} />}
                onClick={startThread}
              >
                <Trans>Start thread</Trans>
              </ContextMenuButton>
            }
          >
            {(thread) => (
              <ContextMenuButton
                icon={<Icon name="chat-circle" size={16} />}
                onClick={() =>
                  navigate(
                    `/server/${thread().serverId}/channel/${thread().id}`,
                  )
                }
              >
                <Trans>Open thread</Trans>
              </ContextMenuButton>
            )}
          </Show>
        </Show>
        <Show when={!official()}>
          <AppsSubMenu
            kind="Message"
            serverId={props.message!.server?.id}
            channelId={props.message!.channelId}
            targetId={props.message!.id}
          />
        </Show>
        <Show when={canReact() || canReply() || canForward()}>
          <ContextMenuDivider />
        </Show>

        {/* 2 · read & copy */}
        <ContextMenuButton icon={MdMarkChatUnread} onClick={markAsUnread}>
          <Trans>Mark as unread</Trans>
        </ContextMenuButton>
        <Show when={!quick()}>
          <ContextMenuButton icon={MdContentCopy} onClick={copyText}>
            <Trans>Copy text</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={!official()}>
          <ContextMenuButton icon={MdLink} onClick={copyMessageLink}>
            <Trans>Copy message link</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={state.settings.getValue("advanced:copy_id")}>
          <ContextMenuButton icon={MdBadge} onClick={copyId}>
            <Trans>Copy message ID</Trans>
          </ContextMenuButton>
        </Show>
        {/* plugins with context.message.selected get this one message, on click */}
        <For
          each={
            props.message && !official() && pluginsEnabled(client())
              ? pluginMessageActions(i18n.locale || "en")
              : []
          }
        >
          {(action) => (
            <ContextMenuButton
              icon={MdApps}
              onClick={() =>
                pluginHooks.runMessageAction(action.pluginId, action.actionId, {
                  id: props.message!.id,
                  channel_id: props.message!.channelId,
                  content: props.message!.content ?? "",
                  author_name:
                    props.message!.author?.displayName ??
                    props.message!.author?.username ??
                    "",
                  created_at: props.message!.createdAt.getTime(),
                })
              }
            >
              {action.title} · {action.pluginName}
            </ContextMenuButton>
          )}
        </For>

        {/* 3 · manage */}
        <Show
          when={
            canEdit() || canPin() || canEndThisPoll() || canRemovePreviews()
          }
        >
          <ContextMenuDivider />
        </Show>
        <Show when={canEdit()}>
          <ContextMenuButton
            icon={MdEdit}
            onClick={() => state.draft.setEditingMessage(props.message!)}
          >
            <Trans>Edit message</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={canPin()}>
          <ContextMenuButton icon={MdPin} onClick={pinMessage}>
            <Switch fallback={<Trans>Pin message</Trans>}>
              <Match when={props.message!.pinned}>
                <Trans>Unpin message</Trans>
              </Match>
            </Switch>
          </ContextMenuButton>
        </Show>

        <Show when={canRemovePreviews()}>
          <ContextMenuButton
            icon={<Icon name="x" size={16} />}
            onClick={removePreviews}
            data-testid="menu-remove-previews"
          >
            <Trans>Remove link previews</Trans>
          </ContextMenuButton>
        </Show>

        <Show when={canEndThisPoll()}>
          <ContextMenuButton
            icon={<Icon name="stop" size={16} />}
            onClick={() =>
              openModal({ type: "end_poll", message: props.message! })
            }
            data-testid="menu-end-poll"
          >
            <Trans>End poll</Trans>
          </ContextMenuButton>
        </Show>

        {/* 4 · destructive */}
        <Show when={canManageReactions() || canDelete() || canReport()}>
          <ContextMenuDivider />
        </Show>
        {/* starts a selection, removes nothing yet: neutral, above the red rows */}
        <SelectMessagesMenuItem message={props.message} />
        <Show when={canManageReactions()}>
          <ContextMenuSubMenu
            icon={MdDeleteSweep}
            onClick={() => props.message!.clearReactions()}
            destructive
            buttonContent={<Trans>Remove reaction</Trans>}
          >
            <For each={[...props.message!.reactions.keys()]}>
              {(key) => (
                <ContextMenuButton
                  onClick={() => props.message!.unreact(key, true)}
                >
                  <Switch fallback={<UnicodeEmoji emoji={key} />}>
                    <Match when={key.length === 26}>
                      <CustomEmoji id={key} />
                    </Match>
                  </Switch>
                </ContextMenuButton>
              )}
            </For>
          </ContextMenuSubMenu>
        </Show>
        <Show when={canManageReactions()}>
          <ContextMenuButton
            symbol={MdSentimentContent}
            onClick={() => props.message!.clearReactions()}
            destructive
          >
            <Trans>Remove all reactions</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={canDelete() && !quick()}>
          <ContextMenuButton
            icon={MdDelete}
            onClick={deleteMessage}
            destructive
          >
            <Trans>Delete message</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={canReport()}>
          <ContextMenuButton icon={MdReport} onClick={report} destructive>
            <Trans>Report message</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={canReport() && props.file instanceof File}>
          <ContextMenuButton icon={MdReport} onClick={reportFile} destructive>
            <Trans>Report attachment</Trans>
          </ContextMenuButton>
        </Show>
        <Show when={canReport() && props.message?.webhook}>
          <ContextMenuButton
            icon={MdReport}
            onClick={reportWebhook}
            destructive
          >
            <Trans>Report webhook</Trans>
          </ContextMenuButton>
        </Show>
      </Show>
    </ContextMenu>
  );
}

/**
 * Phone sheet: the most used actions, side by side, at the top
 *
 *   [reply]  [react]  [copy]  [delete]
 */
export const QuickRow = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
  },
});

/** Six reactions to start from; the seventh tile opens the whole picker */
const QUICK_REACTIONS = [
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F44D}",
  "\u{1F525}",
  "\u{1F389}",
  "\u{1F440}",
];

const ReactRow = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "8px",
  },
});

const ReactTile = styled("a", {
  base: {
    // (!important: the phone sheet sizes every menu row, FloatingManager)
    minHeight: "46px !important",
    padding: "0 !important",
    display: "grid",
    placeItems: "center",
    borderRadius: "12px",
    cursor: "pointer",
    background:
      "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
    "--z-icon-color": "var(--z-fg-secondary)",
    "--emoji-size": "24px",
    WebkitTapHighlightColor: "transparent",
    transition: "scale 100ms ease",
    _motionReduce: { transition: "none" },
    _active: {
      scale: "0.92",
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
    "&:focus-visible": {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
  },
});

export const QuickAction = styled("a", {
  base: {
    flex: "1 1 0",
    minWidth: 0,
    minHeight: "64px !important",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    // (!important: the phone sheet sizes every menu row, FloatingManager)
    gap: "6px !important",
    paddingBlock: "8px",
    paddingInline: "2px !important",
    borderRadius: "14px",
    background:
      "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
    cursor: "pointer",
    // 12 px, medium: "Antworten" fits a quarter of a 320 px screen
    fontSize: "12px !important",
    fontWeight: 500,
    lineHeight: "16px",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-fg-primary)",
    WebkitTapHighlightColor: "transparent",
    "& > span:last-child": {
      // the sheet gives its rows a larger text; these four are captions
      fontSize: "12px !important",
      fontWeight: "500 !important",
      lineHeight: "16px !important",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
    "&:focus-visible": {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
    "&[data-danger]": {
      color: "var(--z-danger)",
      "--z-icon-color": "var(--z-icon-danger, var(--z-danger))",
    },
  },
});
