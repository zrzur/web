import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";

import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/solid/macro";
import { Channel, ConnectionState } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { levelPerks } from "@revolt/client/billing";
import { debounce } from "@revolt/common";
import { createIsTimedOut } from "@revolt/common/lib/createIsTimedOut";
import { translatedError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { createKeybind, Keybind, KeybindAction } from "@revolt/keybinds";
import {
  listenForMentionClicks,
  setMentionTarget,
} from "@revolt/keybinds/mention";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import {
  CompositionMediaPicker,
  FileDropAnywhereCollector,
  FilePasteCollector,
  humanFileSize,
  IconButton,
  MessageBox,
  MessageReplyPreview,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { useSearchSpace } from "@revolt/ui/components/utils/autoComplete";
import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  CommandPicker,
  runActiveCommand,
} from "@revolt/app/interface/channels/text/interactions";
import { useBotDms } from "@revolt/app/interface/channels/text/interactions/botDms";
import {
  dmBot,
  markStarted,
} from "@revolt/app/interface/channels/text/interactions/botLinks";
import { pollsEnabled } from "@revolt/app/interface/channels/text/poll/pollModel";
import {
  composerForShortcut,
  forgetComposer,
  isCreatePollShortcut,
  noteComposer,
  noteComposerFocus,
} from "@revolt/app/interface/channels/text/poll/pollShortcut";
import { startAccess } from "@revolt/app/interface/channels/threadAccess";
import { ContextMenu, ContextMenuButton } from "@revolt/app/menus/ContextMenu";
import Breakpoint from "@revolt/common/Breakpoint";
import { deviceMac, shortcutFor } from "@revolt/keybinds/active";
import { ariaKeys } from "@revolt/keybinds/keyLabels";
import type { ShortcutId } from "@revolt/keybinds/keymap";
import { isMac } from "@revolt/keybinds/shortcuts";
import type { AddChoice } from "./ComposerAddPanel";
import { RulesGate } from "./RulesGate";

// phones only, fetched on the first tap on the "+": kept out of the files
// the app installs up front (scripts/precacheShell.mjs)
const ComposerAddPanel = lazyRetry(
  () =>
    import("./ComposerAddPanel").then((m) => ({ default: m.ComposerAddPanel })),
  () => null,
);

// The cards of files waiting to be sent: load with the first file added
// (scripts/precacheShell.mjs). If the file still does not arrive after a
// second try, the cards stay hidden; the files are still sent.
const FileCarousel = lazyRetry(
  () =>
    import(
      "@revolt/ui/components/features/messaging/composition/FileCarousel"
    ).then((m) => ({ default: m.FileCarousel })),
  () => null,
);

// Shown only while a voice message is recorded: loads on the first recording
// (scripts/precacheShell.mjs). If its file still does not arrive after a
// second try, the recording closes so the button works again.
const VoiceRecorder = lazyRetry(
  () =>
    import(
      "@revolt/ui/components/features/messaging/composition/VoiceRecorder"
    ).then((m) => ({ default: m.VoiceRecorder })),
  (props: { onSend: (file: File) => void; onClose: () => void }) => {
    queueMicrotask(props.onClose);
    return null;
  },
);

interface Props {
  /**
   * Channel to compose for
   */
  channel: Channel;

  /**
   * Notify parent component when a message is sent
   */
  onMessageSend?: () => void;
}

/**
 * Message composition engine
 */
export function MessageComposition(props: Props) {
  const state = useState();
  const { t } = useLingui();
  const client = useClient();
  const botDms = useBotDms();
  const { limits } = useInstance();
  const { openModal, isOpen } = useModals();

  const isTimedOut = createIsTimedOut(
    () => props.channel.server?.member?.timeout,
  );

  createKeybind(KeybindAction.CHAT_JUMP_END, () =>
    setNodeReplacement(["_focus"]),
  );

  createKeybind(KeybindAction.CHAT_FOCUS_COMPOSITION, () =>
    setNodeReplacement(["_focus"]),
  );

  /**
   * Get the draft for the current channel
   * @returns Draft
   */
  function draft() {
    return state.draft.getDraft(props.channel.id);
  }

  const messageLength = () => draft().content?.length ?? 0;
  const maxMessageLength = () => limits().message_length;
  const isAlmostTooLong = () => messageLength() > maxMessageLength() - 200;
  const wayTooLong = () => messageLength() > maxMessageLength() + 9999;

  /**
   * What to do about a message over the limit, in plain words (the counter
   * alone only turned red, and Send did nothing)
   */
  function tooLongText() {
    // plain digits, like the counter next to the box
    const over = messageLength() - maxMessageLength();
    const max = maxMessageLength();
    return plural(over, {
      one: `This message is too long. Remove # character to send it (up to ${max}).`,
      other: `This message is too long. Remove # characters to send it (up to ${max}).`,
    });
  }

  const isTooLong = () => messageLength() > maxMessageLength();

  // read out once when the text first goes over the limit (a sentence
  // without a number, so it is not repeated on every key); the region stays
  // mounted and empty otherwise, so screen readers announce the change
  const [tooLongSpoken, setTooLongSpoken] = createSignal("");
  createEffect(
    on(isTooLong, (over, was) => {
      if (over && !was)
        setTooLongSpoken(t`Your message is longer than the limit.`);
      else if (!over) setTooLongSpoken("");
    }),
  );

  // Can the user upload files here?
  const canUploadFiles = createMemo(() => {
    return (
      props.channel.havePermission("SendMessage") &&
      props.channel.havePermission("UploadFiles")
    );
  });

  // Biggest file allowed here: yours, or the server's supercharge level
  // (the server checks the same rule)
  const uploadLimit = () =>
    Math.max(
      limits().file_upload_size_limits.attachments ?? 0,
      levelPerks(props.channel.server?.supercharge?.level)?.attachments ?? 0,
    );

  // Whether the send button should be active/clickable
  const canSend = createMemo(() => {
    const draftContent = draft()?.content ?? "";
    const draftFiles = draft()?.files ?? [];

    const tooLong = messageLength() > maxMessageLength();

    const isSlowmode = props.channel.userSlowmode();

    return (
      !tooLong &&
      (draftContent.trim().length > 0 || draftFiles.length > 0) &&
      !isSlowmode &&
      !isTimedOut()
    );
  });

  // Nothing typed or attached: the row has room for the poll, GIF and voice
  // buttons. They used to follow !canSend(), so a message over the length
  // limit (it cannot be sent) brought all three back while the text was
  // still there, and the text column was squeezed to a few pixels
  const draftEmpty = createMemo(
    () =>
      !(draft()?.content ?? "").trim().length && !(draft()?.files ?? []).length,
  );

  // TEMP
  function currentValue() {
    return draft()?.content ?? "";
  }

  const [initialValue, setInitialValue] = createSignal([
    currentValue(),
  ] as const);

  const [nodeReplacement, setNodeReplacement] =
    createSignal<readonly [string | "_focus"]>();

  // bind this composition instance to the global node replacement signal
  state.draft._setNodeReplacement = setNodeReplacement;
  onCleanup(() => (state.draft._setNodeReplacement = undefined));

  createEffect(
    on(
      () => props.channel,
      () => setInitialValue([currentValue()]),
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => currentValue(),
      (value) => {
        if (value === "") {
          setInitialValue([""]);
        }
      },
      { defer: true },
    ),
  );
  // END TEMP

  /**
   * Keep track of last time we sent a typing packet
   */
  let isTyping: number | undefined = undefined;

  /**
   * Send typing packet
   */
  function startTyping() {
    if (typeof isTyping === "number" && +new Date() < isTyping) return;

    const ws = client()!.events;
    if (ws.state === ConnectionState.Connected) {
      isTyping = +new Date() + 2500;
      ws.send({
        type: "BeginTyping",
        channel: props.channel.id,
      });
    }
  }

  /**
   * Send stop typing packet
   */
  function stopTyping() {
    if (isTyping) {
      const ws = client()!.events;
      if (ws.state === ConnectionState.Connected) {
        isTyping = undefined;
        ws.send({
          type: "EndTyping",
          channel: props.channel.id,
        });
      }
    }
  }

  /** The bot's commands: a "/" in an empty box opens the list */
  function openCommands() {
    const content = draft()?.content ?? "";
    if (!content.startsWith("/")) {
      const next = content ? `/ ${content}` : "/";
      state.draft.setDraft(props.channel.id, { content: next });
      setInitialValue([next]);
    }
    setNodeReplacement(["_focus"]);
  }

  /**
   * Stop typing after some time
   */
  const delayedStopTyping = debounce(stopTyping, 1000); // eslint-disable-line solid/reactivity

  /**
   * Send a message using the current draft
   * @param useContent Content to send
   */
  async function sendMessage(useContent?: unknown) {
    // a picked slash command runs instead of being sent as text
    if (typeof useContent !== "string" && runActiveCommand()) return;
    if (!canSend() && typeof useContent !== "string") {
      return;
    } else if (props.channel.userSlowmode()) {
      return;
    }
    stopTyping();
    props.onMessageSend?.();
    // writing to a bot first works like Start: the Start screen goes
    if (dmBot(props.channel)) markStarted(props.channel.id);

    if (typeof useContent === "string") {
      const currentDraft = draft();
      if (
        currentDraft?.replies?.length &&
        !currentDraft.content &&
        !currentDraft.files?.length
      ) {
        state.draft.setDraft(props.channel.id, {
          ...currentDraft,
          content: useContent,
        });
        return state.draft.sendDraft(client(), props.channel);
      }
      // a GIF (or anything else sent in one tap) goes out at once, with no
      // row in the chat while it is on its way: a refusal (auto-moderation,
      // slow mode, no connection) must be said, or the tap looks like it
      // did nothing (owner, 2026-11-18: "a GIF is not sent")
      return props.channel.sendMessage(useContent).catch((error) => {
        openModal({ type: "error2", error });
      });
    }

    state.draft.sendDraft(client(), props.channel);
  }

  /**
   * Shorthand for updating the draft
   */
  function setContent(content: string) {
    state.draft.setDraft(props.channel.id, { content });
    startTyping();
  }

  /**
   * Handle files being added to the draft.
   * @param files List of files
   */
  function onFiles(files: File[]) {
    if (!canUploadFiles()) return;
    const rejectedFiles: File[] = [];
    const validFiles: File[] = [];
    const maxSize = uploadLimit();

    for (const file of files) {
      if (file.size > maxSize) {
        console.log("File too large:", file);
        rejectedFiles.push(file);
      } else {
        validFiles.push(file);
      }
    }

    if (rejectedFiles.length > 0) {
      const maxSizeFormatted = humanFileSize(maxSize);

      if (rejectedFiles.length === 1) {
        const file = rejectedFiles[0];
        const fileSize = humanFileSize(file.size);
        const error = translatedError(
          t`The file "${file.name}" (${fileSize}) exceeds the maximum size limit of ${maxSizeFormatted}.`,
        );
        error.name = t`File too large`;
        openModal({
          type: "error2",
          error,
        });
      } else {
        const error = translatedError(
          t`${rejectedFiles.length} files exceed the maximum size limit of ${maxSizeFormatted} and were not uploaded.`,
        );
        error.name = t`Files too large`;
        openModal({
          type: "error2",
          error,
        });
      }
    }

    for (const file of validFiles) {
      state.draft.addFile(props.channel.id, file);
    }
  }

  /**
   * Add a file to the message
   */
  const phone = window.matchMedia(Breakpoint.phone).matches;
  let pickerTriggers:
    | {
        onClickGif: (
          event: unknown,
          ref?: HTMLElement,
          placement?: "top-start",
        ) => void;
        onClickAdd: (event: unknown, ref?: HTMLElement) => void;
      }
    | undefined;
  let addButton: HTMLDivElement | undefined;
  // phones: the "+" panel is open (the button shows an X meanwhile)
  const [adding, setAdding] = createSignal(false);

  // announcement channels: only people who can manage messages post
  const announcementOnly = () =>
    props.channel.announcement &&
    !props.channel.havePermission("ManageMessages");

  // Polls: on for this server, and the person may post rich content here
  const canPoll = createMemo(
    () =>
      pollsEnabled(client()) &&
      props.channel.havePermission("SendMessage") &&
      props.channel.havePermission("SendEmbeds") &&
      !isTimedOut() &&
      !announcementOnly(),
  );

  function createPoll() {
    if (!canPoll()) return;
    openModal({ type: "create_poll", channel: props.channel });
  }

  // Ctrl+Shift+8 (Command on a Mac) opens "Create poll" for the message box
  // focused last (listed in the shortcuts screen); not while a window is
  // open or something else already took the key
  /** `aria-keyshortcuts` for a button, with the person's own keys */
  const keysFor = (id: ShortcutId) =>
    ariaKeys(state.keybinds.table().byId[id], deviceMac());
  const composerKey = `${props.channel.id}:${Math.random().toString(36).slice(2)}`;

  // Shift+click on a person, role or channel mentions it here (Ctrl+/):
  // in the box used last, else the box of the channel on screen
  onCleanup(
    setMentionTarget({
      key: composerKey,
      // the box stays when the channel changes: read it each time
      get channelId() {
        return props.channel.id;
      },
      insert: (text) => {
        if (!props.channel.havePermission("SendMessage")) return false;
        setNodeReplacement([text]);
        return true;
      },
    }),
  );
  listenForMentionClicks();
  const mac = isMac();
  let composerRoot: HTMLDivElement | undefined;
  onMount(() => {
    noteComposer(composerKey);
    const onFocusIn = (event: FocusEvent) => {
      if (composerRoot?.contains(event.target as Node))
        noteComposerFocus(composerKey);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      // Ctrl+Shift+U uploads a file, Ctrl+E opens the emoji picker
      // (Command on a Mac; changeable in Ctrl+/)
      const id = shortcutFor(event);
      if (id === "upload_file" || id === "open_emoji_picker") {
        if (composerForShortcut() !== composerKey || isOpen()) return;
        event.preventDefault();
        if (id === "upload_file") addFile();
        else
          document
            .querySelector<HTMLElement>(
              `[data-shortcut-target="emoji"][data-composer="${composerKey}"]`,
            )
            ?.click();
        return;
      }
      if (!isCreatePollShortcut(event, mac)) return;
      if (composerForShortcut() !== composerKey || isOpen()) return;
      event.preventDefault();
      createPoll();
    };
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      forgetComposer(composerKey);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("keydown", onKeyDown);
    });
  });

  function addFile(accept = "*", capture?: "environment") {
    if (!canUploadFiles()) return;

    const input = document.createElement("input");
    input.accept = accept;
    if (capture) input.setAttribute("capture", capture);
    input.type = "file";
    input.multiple = true;
    input.style.display = "none";

    input.addEventListener("change", async (e) => {
      // Get all attached files
      const files = (e.currentTarget as HTMLInputElement)?.files;

      // Remove element from DOM
      input.remove();

      // Skip execution if no files specified
      if (!files) return;
      onFiles([...files]);
    });

    // iOS requires us to append the file input
    // to DOM to allow us to add any images
    document.body.appendChild(input);
    input.click();
  }

  /**
   * Remove a file by its ID
   * @param fileId File ID
   */
  function removeFile(fileId: string) {
    state.draft.removeFile(props.channel.id, fileId);
  }

  /**
   * Check if a file is marked as a spoiler
   * @param fileId File ID
   */
  function isSpoiler(fileId: string) {
    return state.draft.isFileSpoiler(fileId);
  }

  /**
   * Toggle spoiler state for a file
   * @param fileId File ID
   */
  function toggleSpoiler(fileId: string) {
    state.draft.toggleFileSpoiler(fileId);
  }

  const searchSpace = useSearchSpace(() => props.channel, client);

  // phones: what the "+" panel offers here; a choice that is not allowed in
  // this channel is left out
  function addChoices(panel: { close: () => void; openGif: () => void }) {
    const then = (act: () => void) => () => {
      panel.close();
      act();
    };
    const list: AddChoice[] = [];
    if (canUploadFiles()) {
      list.push(
        {
          id: "camera",
          icon: "video-camera",
          label: t`Camera`,
          onPick: then(() => addFile("image/*", "environment")),
        },
        {
          id: "pictures",
          icon: "image",
          label: t`Photos and videos`,
          onPick: then(() => addFile("image/*,video/*")),
        },
        {
          id: "files",
          icon: "file",
          label: t`Files`,
          onPick: then(() => addFile()),
        },
      );
      if (props.channel.havePermission("SendEmbeds"))
        list.push({
          id: "gif",
          icon: "gif",
          label: t`GIF picker`,
          onPick: panel.openGif,
        });
      list.push({
        id: "voice",
        icon: "microphone",
        label: t`Voice message`,
        onPick: then(() => setRecording(true)),
      });
    }
    if (canPoll())
      list.push({
        id: "poll",
        icon: "poll",
        label: t`Create poll`,
        onPick: then(createPoll),
        testId: "composer-create-poll",
      });
    if (startAccess(props.channel) === "allowed")
      list.push({
        id: "thread",
        icon: "chats-circle",
        label: t`New thread`,
        onPick: then(() =>
          openModal({ type: "create_thread", channel: props.channel }),
        ),
      });
    list.push({
      id: "commands",
      icon: "lightning",
      label: t`Commands`,
      onPick: then(() => {
        const content = draft()?.content ?? "";
        if (!content.startsWith("/")) {
          state.draft.setDraft(props.channel.id, { content: "/" + content });
          setInitialValue(["/" + content]);
        }
      }),
    });
    return list;
  }

  // voice messages: recorded audio is sent as a normal attachment
  const [recording, setRecording] = createSignal(false);

  // the message box is narrow: poll, GIF and voice live in the "+" menu
  const [compact, setCompact] = createSignal(false);
  // the narrow "+" menu is open (for aria-expanded)
  const [menuOpen, setMenuOpen] = createSignal(false);
  const canGif = () => props.channel.havePermission("SendEmbeds");
  createEffect(
    on(
      () => props.channel.id,
      () => setRecording(false),
    ),
  );
  function sendVoice(file: File) {
    setRecording(false);
    if (file.size > uploadLimit()) {
      return onFiles([file]); // shows the size error
    }
    state.draft.addFile(props.channel.id, file);
    void sendMessage();
  }

  return (
    <>
      <Show when={state.draft.hasAdditionalElements(props.channel.id)}>
        <Keybind
          keybind={KeybindAction.CHAT_REMOVE_COMPOSITION_ELEMENT}
          onPressed={() => state.draft.popFromDraft(props.channel.id)}
        />
      </Show>
      <Show when={draft().files?.length}>
        <FileCarousel
          files={draft().files ?? []}
          getFile={state.draft.getFile}
          addFile={addFile}
          removeFile={removeFile}
          isSpoiler={isSpoiler}
          toggleSpoiler={toggleSpoiler}
        />
      </Show>
      <For each={draft().replies ?? []}>
        {(reply) => {
          const message = client()!.messages.get(reply.id);

          /**
           * Toggle mention on reply
           */
          function toggle() {
            state.draft.toggleReplyMention(props.channel.id, reply.id);
          }

          /**
           * Dismiss a reply
           */
          function dismiss() {
            state.draft.removeReply(props.channel.id, reply.id);
          }

          return (
            <MessageReplyPreview
              message={message}
              mention={reply.mention}
              toggle={toggle}
              dismiss={dismiss}
              self={message?.authorId === client()!.user!.id}
            />
          );
        }}
      </For>
      <Show when={recording()}>
        <VoiceRecorder onSend={sendVoice} onClose={() => setRecording(false)} />
      </Show>
      <CommandPicker
        channel={props.channel}
        content={draft()?.content ?? ""}
        setContent={(content) => {
          state.draft.setDraft(props.channel.id, { content });
          setInitialValue([content]);
        }}
      />
      <Show when={props.channel.server?.mustAcceptRules}>
        <RulesGate server={props.channel.server!} />
      </Show>
      <LiveRegion role="status" aria-live="polite" data-composer-too-long-live>
        {tooLongSpoken()}
      </LiveRegion>
      <Show when={isTooLong()}>
        <TooLong data-composer-too-long>
          <Icon name="warning" size={18} />
          <TooLongText>{tooLongText()}</TooLongText>
        </TooLong>
      </Show>
      <MessageBox
        initialValue={initialValue()}
        nodeReplacement={nodeReplacement()}
        onSendMessage={() => sendMessage()}
        onTyping={delayedStopTyping}
        onEditLastMessage={() => state.draft.setEditingMessage(true)}
        content={draft()?.content ?? ""}
        setContent={setContent}
        actionsStart={
          <Show
            when={
              props.channel.havePermission("UploadFiles") ||
              (phone && canPoll()) ||
              (!phone && compact() && (canPoll() || canGif()))
            }
            fallback={<MessageBox.InlineIcon size="short" />}
          >
            <MessageBox.InlineIcon>
              {/* phones: the plus opens a sheet of things to add; wider
                  screens upload a file with one click, and a right-click
                  offers a file or a poll where polls can be posted. In a
                  narrow box (MessageBox COMPOSER_COMPACT_WIDTH) the poll,
                  GIF and voice buttons are hidden and the plus opens a
                  menu with them on a click */}
              <div
                ref={addButton}
                // a box of its own (not display: contents): the "+" menu and
                // the GIF picker opened from it are placed against it
                style={{ display: "flex" }}
                use:floating={
                  !phone && (canPoll() || compact())
                    ? {
                        contextMenu: () => {
                          onMount(() => setMenuOpen(true));
                          onCleanup(() => setMenuOpen(false));
                          return (
                            <ContextMenu>
                              {/* one order with the phone sheet: files, GIF,
                                  voice, poll */}
                              <Show when={canUploadFiles()}>
                                <ContextMenuButton
                                  icon={<Icon name="file" size={20} />}
                                  onClick={() => addFile()}
                                >
                                  {t`Upload file`}
                                </ContextMenuButton>
                              </Show>
                              <Show
                                when={compact() && canGif() && draftEmpty()}
                              >
                                <ContextMenuButton
                                  icon={<Icon name="gif" size={20} />}
                                  onClick={() => {
                                    // the real "+" button is the anchor and
                                    // the trigger: Escape gives focus back to it
                                    const plus =
                                      addButton?.querySelector("button") ??
                                      undefined;
                                    // start side: grows from the "+" over
                                    // the text, in Arabic too (floating-ui
                                    // reads start in the writing direction)
                                    pickerTriggers?.onClickGif(
                                      { currentTarget: plus },
                                      plus,
                                      "top-start",
                                    );
                                  }}
                                >
                                  {t`GIF picker`}
                                </ContextMenuButton>
                              </Show>
                              <Show
                                when={
                                  compact() &&
                                  draftEmpty() &&
                                  canUploadFiles() &&
                                  !recording()
                                }
                              >
                                <ContextMenuButton
                                  icon={<Icon name="microphone" size={20} />}
                                  onClick={() => setRecording(true)}
                                >
                                  {t`Voice message`}
                                </ContextMenuButton>
                              </Show>
                              <Show when={canPoll()}>
                                <ContextMenuButton
                                  icon={<Icon name="poll" size={20} />}
                                  onClick={createPoll}
                                  data-testid="composer-create-poll"
                                >
                                  {t`Create poll`}
                                </ContextMenuButton>
                              </Show>
                            </ContextMenu>
                          );
                        },
                        // narrow box: a click opens it above the "+", towards
                        // the text (never over the account panel in Arabic)
                        ...(compact()
                          ? {
                              contextMenuHandler: "click" as const,
                              // floating-ui reads "start" in the writing
                              // direction: the right edge in Arabic
                              contextMenuPlacement: "top-start" as const,
                            }
                          : {}),
                      }
                    : {}
                }
              >
                <IconButton
                  aria-label={
                    phone
                      ? adding()
                        ? t`Close`
                        : t`Add`
                      : compact()
                        ? t`Add`
                        : t`Upload file`
                  }
                  aria-haspopup={
                    phone ? "dialog" : compact() ? "menu" : undefined
                  }
                  aria-expanded={
                    phone ? adding() : compact() ? menuOpen() : undefined
                  }
                  data-testid="composer-add"
                  aria-keyshortcuts={keysFor("upload_file")}
                  onPress={(event) => {
                    if (phone) pickerTriggers?.onClickAdd(event, addButton);
                    // narrow box: a click opens the menu (use:floating on
                    // the wrapper). Enter and Space press the button without
                    // a native click, so give the wrapper one
                    else if (compact()) {
                      if (
                        (event as { pointerType?: string }).pointerType ===
                        "keyboard"
                      )
                        addButton?.dispatchEvent(
                          new MouseEvent("click", { bubbles: true }),
                        );
                    } else if (canUploadFiles()) addFile();
                  }}
                >
                  <span
                    class="z-add-turn"
                    data-open={adding() ? "" : undefined}
                  >
                    <Symbol type="outlined" size={22}>
                      add
                    </Symbol>
                  </span>
                </IconButton>
              </div>
            </MessageBox.InlineIcon>
          </Show>
        }
        actionsEnd={
          <MessageBox.ActionContainer column>
            <Show when={isAlmostTooLong()}>
              <MessageBox.FloatingAction
                size="normal"
                error={messageLength() > maxMessageLength()}
                data-composer-counter
              >
                {wayTooLong() ? (
                  t`Too long`
                ) : (
                  // the sign stays on the left of the number in Arabic too
                  <bdi dir="ltr">
                    {String(maxMessageLength() - messageLength()).replace(
                      "-",
                      "−",
                    )}
                  </bdi>
                )}
              </MessageBox.FloatingAction>
            </Show>
            <MessageBox.ActionContainer>
              <CompositionMediaPicker
                onMessage={sendMessage}
                onTextReplacement={(text) => setNodeReplacement([text])}
                channel={props.channel}
                add={
                  phone
                    ? (panel) => (
                        <Suspense>
                          <ComposerAddPanel choices={addChoices(panel)} />
                        </Suspense>
                      )
                    : undefined
                }
                onShown={(shown) => setAdding(shown === "add")}
              >
                {(triggerProps) => (
                  <>
                    {/* phones with the "+" sheet: GIF lives there, so the
                        row keeps room for the message */}
                    {void (pickerTriggers = triggerProps)}
                    {/* polls: their own button where they can be posted
                        (phones have it in the "+" sheet) */}
                    <Show when={canPoll() && draftEmpty() && !phone}>
                      <MessageBox.InlineIcon data-composer-extra>
                        <IconButton
                          aria-label={t`Create poll`}
                          data-testid="composer-create-poll"
                          use:floating={{
                            tooltip: {
                              placement: "top",
                              content: t`Create poll`,
                            },
                          }}
                          onPress={createPoll}
                        >
                          <Icon name="poll" size={22} />
                        </IconButton>
                      </MessageBox.InlineIcon>
                    </Show>
                    <Show
                      when={
                        draftEmpty() &&
                        props.channel.havePermission("SendEmbeds") &&
                        !(phone && canUploadFiles())
                      }
                    >
                      <MessageBox.InlineIcon
                        data-composer-extra={phone ? undefined : ""}
                      >
                        <IconButton
                          aria-label={t`Open GIF picker`}
                          onPress={triggerProps.onClickGif}
                        >
                          <Icon name="gif" size={22} />
                        </IconButton>
                      </MessageBox.InlineIcon>
                    </Show>
                    {/* a DM with a bot: its commands, one tap away */}
                    <Show when={botDms() && dmBot(props.channel)}>
                      <MessageBox.InlineIcon>
                        <IconButton
                          aria-label={t`Commands`}
                          data-testid="composer-commands"
                          use:floating={{
                            tooltip: {
                              placement: "top",
                              content: t`Commands`,
                            },
                          }}
                          onPress={openCommands}
                        >
                          <Icon name="terminal" size={22} />
                        </IconButton>
                      </MessageBox.InlineIcon>
                    </Show>
                    <MessageBox.InlineIcon>
                      <IconButton
                        aria-label={t`Open emoji picker`}
                        aria-keyshortcuts={keysFor("open_emoji_picker")}
                        data-shortcut-target="emoji"
                        data-composer={composerKey}
                        onPress={triggerProps.onClickEmoji}
                      >
                        <Symbol type="outlined" size={22}>
                          mood
                        </Symbol>
                      </IconButton>
                    </MessageBox.InlineIcon>
                    <div ref={triggerProps.ref} />
                  </>
                )}
              </CompositionMediaPicker>
              <Show
                when={
                  draftEmpty() && canUploadFiles() && !recording() && !phone
                }
              >
                <MessageBox.InlineIcon data-composer-extra>
                  <IconButton
                    aria-label={t`Record a voice message`}
                    onPress={() => setRecording(true)}
                  >
                    <Icon name="microphone" size={22} />
                  </IconButton>
                </MessageBox.InlineIcon>
              </Show>
            </MessageBox.ActionContainer>
          </MessageBox.ActionContainer>
        }
        placeholder={
          props.channel.type === "SavedMessages"
            ? t`Save to your notes`
            : props.channel.type === "DirectMessage"
              ? t`Message ${props.channel.recipient?.displayName ?? props.channel.recipient?.username}`
              : t`Message ${props.channel.name}`
        }
        sendingAllowed={
          props.channel.havePermission("SendMessage") &&
          !isTimedOut() &&
          !announcementOnly()
        }
        announcementOnly={announcementOnly()}
        timeoutActive={isTimedOut()}
        autoCompleteSearchSpace={searchSpace}
        updateDraftSelection={(start, end) =>
          state.draft.setSelection(props.channel.id, start, end)
        }
        hasActionsAppend={
          state.settings.getValue("appearance:show_send_button") || false
        }
        onCompact={phone ? undefined : setCompact}
        crowded={
          (draft().files?.length ?? 0) > 0 || (draft().replies?.length ?? 0) > 0
        }
        actionsAppend={
          <Show when={state.settings.getValue("appearance:show_send_button")}>
            <MessageBox.InlineIcon ready={canSend()}>
              <IconButton
                aria-label={t`Send message`}
                onPress={() => canSend() && sendMessage()}
              >
                <Symbol type="outlined" size={22}>
                  send
                </Symbol>
              </IconButton>
            </MessageBox.InlineIcon>
          </Show>
        }
      />
      <Show when={canUploadFiles()}>
        <FilePasteCollector onFiles={onFiles} />
        <FileDropAnywhereCollector onFiles={onFiles} />
      </Show>
    </>
  );
}

/**
 * The line above the message box while the text is over the length limit:
 * the shape of the rules bar (RulesGate), with the warning in the danger
 * colour
 */
const TooLong = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginInline: "16px",
    marginBottom: "8px",
    padding: "8px 12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    color: "var(--z-danger)",
    "--z-icon-color": "var(--z-danger)",
  },
});

const TooLongText = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "20px",
    overflowWrap: "anywhere",
  },
});

/** Read out, not shown */
const LiveRegion = styled("span", {
  base: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
});
