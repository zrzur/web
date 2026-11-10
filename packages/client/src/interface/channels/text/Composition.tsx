import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { Channel, ConnectionState } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { levelPerks } from "@revolt/client/billing";
import { debounce } from "@revolt/common";
import { createIsTimedOut } from "@revolt/common/lib/createIsTimedOut";
import { translatedError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { createKeybind, Keybind, KeybindAction } from "@revolt/keybinds";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import {
  CompositionMediaPicker,
  FileCarousel,
  FileDropAnywhereCollector,
  FilePasteCollector,
  humanFileSize,
  IconButton,
  MessageBox,
  MessageReplyPreview,
} from "@revolt/ui";
import { VoiceRecorder } from "@revolt/ui/components/features/messaging/composition/VoiceRecorder";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { useSearchSpace } from "@revolt/ui/components/utils/autoComplete";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  CommandPicker,
  runActiveCommand,
} from "@revolt/app/interface/channels/text/interactions";
import { pollsEnabled } from "@revolt/app/interface/channels/text/poll/pollModel";
import {
  claimCreatePollShortcut,
  isCreatePollShortcut,
} from "@revolt/app/interface/channels/text/poll/pollShortcut";
import { ContextMenu, ContextMenuButton } from "@revolt/app/menus/ContextMenu";
import Breakpoint from "@revolt/common/Breakpoint";
import { RulesGate } from "./RulesGate";

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
  const { limits } = useInstance();
  const { openModal } = useModals();

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
      return props.channel.sendMessage(useContent);
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
    | { onClickGif: (event: unknown, ref?: HTMLDivElement) => void }
    | undefined;

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

  // Alt+Shift+P opens "Create poll" (listed in the shortcuts screen)
  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCreatePollShortcut(event) || event.repeat) return;
      if (!claimCreatePollShortcut()) return;
      event.preventDefault();
      createPoll();
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
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

  // voice messages: recorded audio is sent as a normal attachment
  const [recording, setRecording] = createSignal(false);
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
      <FileCarousel
        files={draft().files ?? []}
        getFile={state.draft.getFile}
        addFile={addFile}
        removeFile={removeFile}
        isSpoiler={isSpoiler}
        toggleSpoiler={toggleSpoiler}
      />
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
            when={props.channel.havePermission("UploadFiles") || canPoll()}
            fallback={<MessageBox.InlineIcon size="short" />}
          >
            <MessageBox.InlineIcon>
              {/* phones: the plus opens a sheet of things to add; wider
                  screens upload a file straight away, or offer a file or a
                  poll where polls can be posted */}
              <div
                style={{ display: "contents" }}
                use:floating={
                  !phone && canPoll()
                    ? {
                        contextMenu: () => (
                          <ContextMenu>
                            <Show when={canUploadFiles()}>
                              <ContextMenuButton
                                icon={<Icon name="file" size={20} />}
                                onClick={() => addFile()}
                              >
                                {t`Upload file`}
                              </ContextMenuButton>
                            </Show>
                            <ContextMenuButton
                              icon={<Icon name="list-checks" size={20} />}
                              onClick={createPoll}
                              data-testid="composer-create-poll"
                            >
                              {t`Create poll`}
                            </ContextMenuButton>
                          </ContextMenu>
                        ),
                        contextMenuHandler: "click",
                      }
                    : phone
                      ? {
                          contextMenu: () => (
                            <ContextMenu>
                              <Show when={canPoll()}>
                                <ContextMenuButton
                                  icon={<Icon name="list-checks" size={20} />}
                                  onClick={createPoll}
                                  data-testid="composer-create-poll"
                                >
                                  {t`Create poll`}
                                </ContextMenuButton>
                              </Show>
                              <Show when={canUploadFiles()}>
                                <ContextMenuButton
                                  icon={<Icon name="video-camera" size={20} />}
                                  onClick={() =>
                                    addFile("image/*", "environment")
                                  }
                                >
                                  {t`Camera`}
                                </ContextMenuButton>
                                <ContextMenuButton
                                  icon={<Icon name="image" size={20} />}
                                  onClick={() => addFile("image/*,video/*")}
                                >
                                  {t`Photos and videos`}
                                </ContextMenuButton>
                                <ContextMenuButton
                                  icon={<Icon name="file" size={20} />}
                                  onClick={() => addFile()}
                                >
                                  {t`Files`}
                                </ContextMenuButton>
                                <Show
                                  when={props.channel.havePermission(
                                    "SendEmbeds",
                                  )}
                                >
                                  <ContextMenuButton
                                    icon={<Icon name="gif" size={20} />}
                                    onClick={() =>
                                      pickerTriggers?.onClickGif(undefined)
                                    }
                                  >
                                    {t`GIF picker`}
                                  </ContextMenuButton>
                                </Show>
                                <ContextMenuButton
                                  icon={<Icon name="microphone" size={20} />}
                                  onClick={() => setRecording(true)}
                                >
                                  {t`Voice message`}
                                </ContextMenuButton>
                              </Show>
                              <ContextMenuButton
                                icon={<Icon name="lightning" size={20} />}
                                onClick={() => {
                                  const content = draft()?.content ?? "";
                                  if (!content.startsWith("/")) {
                                    state.draft.setDraft(props.channel.id, {
                                      content: "/" + content,
                                    });
                                    setInitialValue(["/" + content]);
                                  }
                                }}
                              >
                                {t`Commands`}
                              </ContextMenuButton>
                            </ContextMenu>
                          ),
                          contextMenuHandler: "click",
                        }
                      : {}
                }
              >
                <IconButton
                  aria-label={phone || canPoll() ? t`Add` : t`Upload file`}
                  aria-haspopup={phone || canPoll() ? "menu" : undefined}
                  data-testid="composer-add"
                  onPress={() => {
                    if (!phone && !canPoll()) addFile();
                  }}
                >
                  <Symbol type="outlined" size={22}>
                    add
                  </Symbol>
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
              >
                {wayTooLong()
                  ? t`Too long`
                  : maxMessageLength() - messageLength()}
              </MessageBox.FloatingAction>
            </Show>
            <MessageBox.ActionContainer>
              <CompositionMediaPicker
                onMessage={sendMessage}
                onTextReplacement={(text) => setNodeReplacement([text])}
                channel={props.channel}
              >
                {(triggerProps) => (
                  <>
                    {/* phones with the "+" sheet: GIF lives there, so the
                        row keeps room for the message */}
                    {void (pickerTriggers = triggerProps)}
                    <Show
                      when={
                        !canSend() &&
                        props.channel.havePermission("SendEmbeds") &&
                        !(phone && canUploadFiles())
                      }
                    >
                      <MessageBox.InlineIcon>
                        <IconButton
                          aria-label={t`Open GIF picker`}
                          onPress={triggerProps.onClickGif}
                        >
                          <Symbol type="outlined" size={22}>
                            gif
                          </Symbol>
                        </IconButton>
                      </MessageBox.InlineIcon>
                    </Show>
                    <MessageBox.InlineIcon>
                      <IconButton
                        aria-label={t`Open emoji picker`}
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
                when={!canSend() && canUploadFiles() && !recording() && !phone}
              >
                <MessageBox.InlineIcon>
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
