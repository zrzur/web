import { Match, Show, Switch } from "solid-js";

import { File, ImageEmbed, Message, VideoEmbed } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { MessageContextMenu, useMessage } from "@revolt/app";
import {
  isAnimatedPicture,
  pictureShown,
  saveData,
  smallPreviewUrl,
  smallPreviews,
} from "@revolt/common/lib/saveData";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { Column } from "@revolt/ui/components/layout";
import { SizedContent, Spoiler } from "@revolt/ui/components/utils";

import { FileInfo } from "./FileInfo";
import { HeldMedia } from "./HeldMedia";
import { MediaPlayer } from "./MediaPlayer";
import { TextFile } from "./TextFile";
import { VoiceMessage } from "./VoiceMessage";
import { isVoiceMessageName, playableVoiceSrc } from "./voice";

/**
 * List of attachments
 */
export const AttachmentContainer = styled(Column, {
  base: {
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "var(--z-box-radius)",
    color: "var(--z-fg-primary)",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    alignSelf: "start",
    width: "420px",
    maxWidth: "100%",
    overflow: "hidden",

    "& audio": {
      width: "100%",
    },
  },
  variants: {
    dynamic: {
      grow: {
        width: "auto",
        minWidth: "min(420px, 100%)",
      },
      shrink: {
        width: "auto",
        maxWidth: "min(420px, 100%)",
      },
    },
  },
});

/**
 * Render a given list of files
 */
export function Attachment(props: { file: File; message?: Message }) {
  const { openModal } = useModals();
  const { reactPicker } = useMessage();
  const instance = useInstance();
  // Save data: the small still preview where the media server makes one,
  // a placeholder with the size where it does not; the picture on a tap
  const shown = () =>
    pictureShown(saveData(), smallPreviews(instance.mediaUrl), props.file);

  return (
    <Switch fallback={`Could not render ${props.file.metadata.type}!`}>
      <Match
        when={
          // the media server may label recorded WebM audio as a plain file
          isVoiceMessageName(props.file.filename) &&
          (props.file.metadata.type === "Audio" ||
            props.file.metadata.type === "Video" ||
            props.file.metadata.type === "File")
        }
      >
        <VoiceMessage
          // the AAC copy where the browser can't play the recording
          src={playableVoiceSrc(props.file.originalUrl, {
            contentType: props.file.contentType,
            name: props.file.filename,
          })}
          channelId={props.message?.channelId}
          contextMenu={() => (
            <MessageContextMenu
              message={props.message}
              reactPicker={reactPicker}
              file={props.file}
            />
          )}
        />
      </Match>
      <Match when={props.file.metadata.type === "Image"}>
        <SizedContent
          width={(props.file.metadata as ImageEmbed).width}
          height={(props.file.metadata as ImageEmbed).height}
        >
          <Show when={props.file.isSpoiler}>
            <Spoiler contentType="Image" />
          </Show>
          <HeldMedia
            held={shown() !== "full"}
            kind={isAnimatedPicture(props.file) ? "gif" : "picture"}
            id={props.file.id}
            size={props.file.size}
            preview={
              shown() === "small"
                ? smallPreviewUrl(props.file.previewUrl)
                : undefined
            }
          >
            <img
              alt={props.file.filename ?? ""}
              class={css({ cursor: "pointer" })}
              onClick={() =>
                openModal({
                  type: "image_viewer",
                  file: props.file,
                })
              }
              loading="lazy"
              src={props.file.createFileURL()}
              use:floating={{
                contextMenu: () => (
                  <MessageContextMenu
                    message={props.message}
                    reactPicker={reactPicker}
                    file={props.file}
                  />
                ),
              }}
            />
          </HeldMedia>
        </SizedContent>
      </Match>
      <Match when={props.file.metadata.type === "Video"}>
        <SizedContent
          width={(props.file.metadata as VideoEmbed).width}
          height={(props.file.metadata as VideoEmbed).height}
        >
          <Show when={props.file.isSpoiler}>
            <Spoiler contentType="Video" />
          </Show>
          <MediaPlayer
            kind="video"
            src={props.file.originalUrl}
            contextMenu={() => (
              <MessageContextMenu
                message={props.message}
                reactPicker={reactPicker}
                file={props.file}
              />
            )}
          />
        </SizedContent>
      </Match>
      <Match when={props.file.metadata.type === "Audio"}>
        {/* songs and other audio share the voice note's look */}
        <VoiceMessage
          src={props.file.originalUrl}
          title={props.file.filename ?? ""}
          detail={props.file.humanReadableSize}
          download={props.file.originalUrl}
          channelId={props.message?.channelId}
          // a real waveform needs the whole file; skip it for big files,
          // and for every file while saving data
          decode={!saveData() && (props.file.size ?? 0) <= 15_000_000}
          contextMenu={() => (
            <MessageContextMenu
              message={props.message}
              reactPicker={reactPicker}
              file={props.file}
            />
          )}
        />
      </Match>
      <Match when={props.file.metadata.type === "File"}>
        <AttachmentContainer dynamic="shrink">
          <FileInfo file={props.file} />
        </AttachmentContainer>
      </Match>
      <Match when={props.file.metadata.type === "Text"}>
        <AttachmentContainer dynamic="grow">
          <FileInfo file={props.file} />
          <TextFile file={props.file} />
        </AttachmentContainer>
      </Match>
    </Switch>
  );
}
