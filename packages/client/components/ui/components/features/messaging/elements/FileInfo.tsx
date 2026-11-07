import { Match, Show, Switch } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { File, MessageEmbed } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { IconButton } from "@revolt/ui/components/design";
import { humanFileSize } from "@revolt/ui/components/utils";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

interface Props {
  /**
   * File information
   */
  file?: File;

  /**
   * Embed information
   */
  embed?: MessageEmbed;
}

/**
 * Information about a given attachment or embed
 */
export function FileInfo(props: Props) {
  const { t } = useLingui();

  function download(url: string, name?: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = name || "file";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const type = () => props.file?.metadata.type ?? props.embed?.type;

  return (
    <Base>
      <TypeTile aria-hidden="true">
        <Switch fallback={<Symbol size={20}>insert_drive_file</Symbol>}>
          <Match when={type() === "Image"}>
            <Symbol size={20}>image</Symbol>
          </Match>
          <Match when={type() === "Video"}>
            <Symbol size={20}>videocam</Symbol>
          </Match>
          <Match when={type() === "Audio"}>
            <Symbol size={20}>music_note</Symbol>
          </Match>
          <Match when={type() === "Text"}>
            <Symbol size={20}>description</Symbol>
          </Match>
        </Switch>
      </TypeTile>
      <Info>
        <Name title={props.file?.filename}>{props.file?.filename}</Name>
        <Show when={props.file?.size}>
          <Size>{humanFileSize(props.file!.size!)}</Size>
        </Show>
      </Info>
      <Show when={props.file}>
        <IconButton
          variant="toolbar"
          size="xs"
          aria-label={t`Download ${props.file!.filename}`}
          use:floating={{
            tooltip: { placement: "top", content: t`Download` },
          }}
          onPress={() =>
            download(props.file!.originalUrl, props.file!.filename)
          }
        >
          <Symbol size={20}>download</Symbol>
        </IconButton>
      </Show>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
});

/**
 * File-type glyph on a soft accent tile
 */
const TypeTile = styled("div", {
  base: {
    flexShrink: 0,
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});

const Info = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

const Name = styled("span", {
  base: {
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "18px",
    color: "var(--z-fg-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Size = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});
