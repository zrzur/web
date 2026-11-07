import { For, Match, Show, Switch, createMemo, onCleanup } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useInstance } from "@revolt/instance";
import { ALLOWED_IMAGE_TYPES } from "@revolt/state";
import { Icon, IconName } from "@revolt/ui/icons/Icon";

interface Props {
  /**
   * Files to display in carousel
   */
  files: string[];

  /**
   * Get file by ID
   * @param fileId ID
   */
  getFile(fileId: string): {
    file: File;
    dataUri?: string;
  };

  /**
   * Invoke file picker to add file
   */
  addFile(): void;

  /**
   * Remove file by ID
   * @param fileId ID
   */
  removeFile(fileId: string): void;

  /**
   * Whether a file is currently marked as a spoiler
   * @param fileId ID
   */
  isSpoiler(fileId: string): boolean;

  /**
   * Toggle spoiler state for a file
   * @param fileId ID
   */
  toggleSpoiler(fileId: string): void;
}

/**
 * Determine file size
 * @param size Bytes
 * @returns Human-readable size
 */
export function determineFileSize(size: number) {
  if (size > 1e6) {
    return `${(size / 1e6).toFixed(2)} MB`;
  } else if (size > 1e3) {
    return `${(size / 1e3).toFixed(2)} KB`;
  }

  return `${size} B`;
}

/** Icon for files we can't preview */
function fileIcon(file: File): IconName {
  if (file.type.startsWith("audio/")) return "music-note";
  if (file.type.startsWith("text/")) return "file-text";
  return "file";
}

/**
 * Files waiting to be sent, shown as cards above the message box:
 * a real preview for images and videos, a type tile for anything else.
 */
export function FileCarousel(props: Props) {
  const { t } = useLingui();
  const { limits } = useInstance();

  return (
    <Show when={props.files.length}>
      <Container>
        <div class={strip()} use:scrollable={{ direction: "x" }}>
          <For each={props.files}>
            {(id, index) => {
              const file = () => props.getFile(id);
              const spoiler = () => props.isSpoiler(id);
              const image = () =>
                ALLOWED_IMAGE_TYPES.includes(file().file.type);
              const video = () => file().file.type.startsWith("video/");

              // first frame of a video, from a local object URL
              const videoUrl = createMemo(() => {
                if (!video()) return;
                const url = URL.createObjectURL(file().file);
                onCleanup(() => URL.revokeObjectURL(url));
                return url;
              });

              const extension = () =>
                file().file.name.includes(".")
                  ? file().file.name.split(".").pop()!.slice(0, 5)
                  : "";

              return (
                <>
                  <Show when={index() === limits().message_attachments}>
                    <Divider aria-hidden="true" />
                  </Show>

                  <Card
                    data-ignored={index() >= limits().message_attachments}
                    title={
                      index() >= limits().message_attachments
                        ? t`Sent in the next message`
                        : undefined
                    }
                  >
                    <Preview data-spoiler={spoiler()}>
                      <Switch
                        fallback={
                          <TypeTile>
                            <Icon name={fileIcon(file().file)} size={28} />
                            <Show when={extension()}>
                              <span>{extension()}</span>
                            </Show>
                          </TypeTile>
                        }
                      >
                        <Match when={image()}>
                          <img src={file().dataUri} alt="" />
                        </Match>
                        <Match when={videoUrl()}>
                          <video
                            src={`${videoUrl()}#t=0.1`}
                            preload="metadata"
                            muted
                            playsinline
                          />
                          <PlayBadge aria-hidden="true">
                            <Icon name="play" size={14} filled />
                          </PlayBadge>
                        </Match>
                      </Switch>

                      <Show when={spoiler()}>
                        <SpoilerLabel>{t`Spoiler`}</SpoilerLabel>
                      </Show>

                      <Show when={image() || video()}>
                        <CornerButton
                          type="button"
                          data-side="start"
                          aria-pressed={spoiler()}
                          aria-label={
                            spoiler() ? t`Remove spoiler` : t`Mark as spoiler`
                          }
                          title={
                            spoiler() ? t`Remove spoiler` : t`Mark as spoiler`
                          }
                          onClick={() => props.toggleSpoiler(id)}
                        >
                          <Icon
                            name={spoiler() ? "eye" : "eye-slash"}
                            size={14}
                          />
                        </CornerButton>
                      </Show>
                      <CornerButton
                        type="button"
                        data-side="end"
                        data-danger="true"
                        aria-label={t`Remove ${file().file.name}`}
                        title={t`Remove`}
                        onClick={() => props.removeFile(id)}
                      >
                        <Icon name="x" size={14} />
                      </CornerButton>
                    </Preview>
                    <Name title={file().file.name}>{file().file.name}</Name>
                    <Size>{determineFileSize(file().file.size)}</Size>
                  </Card>
                </>
              );
            }}
          </For>
          <AddTile
            type="button"
            aria-label={t`Add file`}
            title={t`Add file`}
            onClick={() => props.addFile()}
          >
            <Icon name="plus" size={22} />
          </AddTile>
        </div>
      </Container>
    </Show>
  );
}

/** Same surface as the message box, sitting just above it */
const Container = styled("div", {
  base: {
    userSelect: "none",
    marginBottom: "8px",
    padding: "10px",
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    "--card-width": "164px",
    "--preview-height": "104px",
  },
});

const strip = cva({
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    overflowX: "auto !important",
  },
});

const Card = styled("div", {
  base: {
    flexShrink: 0,
    width: "var(--card-width)",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "6px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-border-subtle)",

    "&[data-ignored='true']": { opacity: 0.45 },
  },
});

const Preview = styled("div", {
  base: {
    position: "relative",
    height: "var(--preview-height)",
    marginBottom: "6px",
    overflow: "hidden",
    borderRadius: "calc(var(--z-radius, 10px) - 3px)",
    background: "color-mix(in srgb, var(--z-fg-primary) 5%, transparent)",

    "& > img, & > video": {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transition: "filter 0.15s ease",
    },
    "&[data-spoiler='true'] > img, &[data-spoiler='true'] > video": {
      filter: "blur(18px) brightness(0.7)",
    },

    // corner buttons appear on hover / keyboard focus
    "& > button": { opacity: 0, transition: "opacity 0.12s ease" },
    "&:hover > button": { opacity: 1 },
    "& > button:focus-visible": { opacity: 1 },
    "& > button[data-danger='true']": { opacity: 1 },
    "& > button[aria-pressed='true']": { opacity: 1 },
  },
});

const TypeTile = styled("div", {
  base: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    "--z-icon-color": "var(--z-icon-neutral)",

    "& span": {
      fontSize: "11px",
      fontWeight: 700,
      color: "var(--z-fg-muted)",
    },
  },
});

const PlayBadge = styled("span", {
  base: {
    position: "absolute",
    top: "50%",
    left: "50%",
    translate: "-50% -50%",
    display: "grid",
    placeItems: "center",
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "rgb(0 0 0 / 55%)",
    color: "#fff",
    "--z-icon-color": "currentColor",
    pointerEvents: "none",
  },
});

const SpoilerLabel = styled("span", {
  base: {
    position: "absolute",
    bottom: "6px",
    insetInlineStart: "6px",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#fff",
    background: "rgb(0 0 0 / 60%)",
    pointerEvents: "none",
  },
});

const CornerButton = styled("button", {
  base: {
    position: "absolute",
    top: "6px",
    zIndex: 2,
    display: "grid",
    placeItems: "center",
    width: "26px",
    height: "26px",
    padding: 0,
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    color: "#fff",
    background: "rgb(0 0 0 / 55%)",
    "--z-icon-color": "currentColor",

    "&[data-side='start']": { insetInlineStart: "6px" },
    "&[data-side='end']": { insetInlineEnd: "6px" },
    _hover: { background: "rgb(0 0 0 / 75%)" },
    "&[data-danger='true']:hover": {
      background: "var(--z-danger-strong, #B85867)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
  },
});

const Name = styled("span", {
  base: {
    paddingInline: "2px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: "17px",
  },
});

const Size = styled("span", {
  base: {
    paddingInline: "2px",
    fontSize: "12px",
    lineHeight: "15px",
    color: "var(--z-fg-muted)",
  },
});

const AddTile = styled("button", {
  base: {
    flexShrink: 0,
    alignSelf: "stretch",
    width: "64px",
    display: "grid",
    placeItems: "center",
    padding: 0,
    borderRadius: "var(--z-radius, 10px)",
    border: "1.5px dashed var(--z-border-strong)",
    background: "transparent",
    color: "var(--z-fg-muted)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    transition: "border-color 0.12s ease, color 0.12s ease",

    _hover: { borderColor: "var(--z-accent)", color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/** Between files sent now and files that wait for the next message */
const Divider = styled("div", {
  base: {
    flexShrink: 0,
    alignSelf: "stretch",
    width: "2px",
    borderRadius: "2px",
    background: "var(--z-border-strong)",
  },
});
