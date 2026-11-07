import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import {
  type TextEmbedField,
  TextEmbed as TextEmbedClass,
  WebsiteEmbed,
} from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Markdown, renderSimpleMarkdown } from "@revolt/markdown";
import { RenderAnchor } from "@revolt/markdown/plugins/anchors";
import { useModals } from "@revolt/modal";
import { Text } from "@revolt/ui/components/design";
import { Column } from "@revolt/ui/components/layout";
import {
  OverflowingText,
  SizedContent,
  Time,
} from "@revolt/ui/components/utils";

import { MessageContextMenu } from "@revolt/app";
import { Attachment } from "./Attachment";
import { MediaPlayer } from "./MediaPlayer";
import { SpecialEmbed } from "./SpecialEmbed";
import { isPlayerEmbed } from "./embedSettings";

const Base = styled("div", {
  base: {
    width: "fit-content",

    display: "flex",
    maxWidth: "calc(min(100%, 420px))",
    flexDirection: "row",
    gap: "12px",
    padding: "12px",
    borderRadius: "10px",
    color: "var(--z-fg-secondary)",
    background: "var(--z-bg-raised)",
    border: "1px solid var(--z-border-soft)",
    // the embed's own colour as a slim leading rule; neutral when it has none
    borderInlineStart: "2px solid var(--z-border-strong)",
    fontSize: "13px",
    lineHeight: "20px",
    // fields need room to sit side by side
    "&[data-rich]": { maxWidth: "calc(min(100%, 520px))" },
  },
});

const Author = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    "& a": { color: "inherit" },
  },
});

const SmallIcon = styled("img", {
  base: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },
});

const FieldRow = styled("div", {
  base: {
    display: "grid",
    gap: "8px 16px",
  },
});

const Field = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

const FieldName = styled("div", {
  base: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    wordWrap: "break-word",
    "& img": { verticalAlign: "middle" },
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "var(--z-fg-tertiary, var(--z-fg-secondary))",
  },
});

const InformationRow = styled("div", {
  base: {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    gap: "var(--gap-md)",
  },
});

const Favicon = styled("img", {
  base: {
    width: "14px",
    height: "14px",
    flexShrink: 0,
  },
});

/** A large embed image given by web address */
const EmbedImage = styled("img", {
  base: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "320px",
    borderRadius: "10px",
  },
});

const PreviewImage = styled("img", {
  base: {
    maxWidth: "88px",
    maxHeight: "88px",
    objectFit: "cover",
    borderRadius: "6px",
  },
});

const Title = styled("span", {
  base: {
    minWidth: 0,
    flexShrink: 1,

    fontSize: "15px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    // only a title that is a link takes the link colour
    "&[data-link]": { color: "var(--z-link) !important" },
    "& img": { verticalAlign: "middle" },
  },
});

const Content = styled(Column, {
  base: {
    minWidth: 0,
  },
});

/**
 * Group fields into rows: up to three inline fields share a row,
 * any other field takes a row of its own
 */
function fieldRows(fields: TextEmbedField[]) {
  const rows: TextEmbedField[][] = [];
  for (const field of fields) {
    const last = rows[rows.length - 1];
    if (field.inline && last && last[0].inline && last.length < 3) {
      last.push(field);
    } else {
      rows.push([field]);
    }
  }
  return rows;
}

const Description = styled("div", {
  base: {
    // the size of message text: embeds are read as much as messages
    fontSize: "14px",
    lineHeight: "20px",
    overflow: "hidden",
    wordWrap: "break-word",
    // folded: about twelve lines, fading out
    "&[data-folded]": {
      maxHeight: "240px",
      maskImage: "linear-gradient(to bottom, black 70%, transparent)",
    },
  },
});

/** Descriptions longer than this start folded */
const FOLD_AT = 600;

/**
 * A bot's description: long ones (up to 4096 characters) start folded so
 * one embed never fills the whole channel
 */
function LongDescription(props: { text: string }) {
  const [open, setOpen] = createSignal(false);
  const long = () => props.text.length > FOLD_AT;
  return (
    <div>
      <Description data-folded={long() && !open() ? "" : undefined}>
        <Markdown content={props.text} />
      </Description>
      <Show when={long()}>
        <MoreButton
          type="button"
          aria-expanded={open()}
          data-embed-more
          onClick={() => setOpen(!open())}
        >
          <Show when={open()} fallback={<Trans>Show more</Trans>}>
            <Trans>Show less</Trans>
          </Show>
        </MoreButton>
      </Show>
    </div>
  );
}

const MoreButton = styled("button", {
  base: {
    marginBlockStart: "4px",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-link)",
    cursor: "pointer",
    "&:hover": { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
      borderRadius: "4px",
    },
  },
});

/**
 * Text Embed
 */
export function TextEmbed(props: { embed: TextEmbedClass | WebsiteEmbed }) {
  const { t } = useLingui();
  const { openModal } = useModals();

  /** Text embed parts only bots and webhooks send */
  const rich = createMemo(() =>
    props.embed.type === "Text" ? (props.embed as TextEmbedClass) : undefined,
  );
  const rows = createMemo(() => fieldRows(rich()?.fields ?? []));

  // one direction for the whole card, from its own words (the author is
  // often a Latin user name, so it does not decide)
  const direction = createMemo(() => {
    const text = [
      props.embed.title,
      ...(rich()?.fields ?? []).map((field) => field.name),
      rich()?.footer?.text,
      props.embed.description,
    ]
      .filter(Boolean)
      .join(" ");
    const first =
      /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]|[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.exec(
        text,
      )?.[0];
    if (!first) return undefined;
    return /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(first)
      ? "rtl"
      : "ltr";
  });

  return (
    <Base
      dir={direction()}
      style={{ "border-inline-start-color": props.embed.colour }}
      data-rich={rows().length ? "" : undefined}
    >
      <Content gap="md" grow>
        <Show when={rich()?.author}>
          {(author) => (
            <Author>
              {/* drawn only when there is an address to load (a refused
                  or unproxied one leaves no broken frame) */}
              <Show when={rich()!.proxiedAuthorIconURL}>
                <SmallIcon
                  loading="lazy"
                  draggable={false}
                  alt=""
                  src={rich()!.proxiedAuthorIconURL}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </Show>
              <OverflowingText>
                <RenderAnchor href={author().url}>{author().name}</RenderAnchor>
              </OverflowingText>
            </Author>
          )}
        </Show>

        <Show
          when={
            props.embed.type === "Website" &&
            (props.embed as WebsiteEmbed).siteName
          }
        >
          <InformationRow>
            <Show when={props.embed.proxiedIconURL}>
              <Favicon
                loading="lazy"
                draggable={false}
                alt=""
                src={props.embed.proxiedIconURL}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </Show>
            <OverflowingText>
              <Text class="label" size="small">
                {(props.embed as WebsiteEmbed).siteName}
              </Text>
            </OverflowingText>
          </InformationRow>
        </Show>

        <Show when={props.embed.title}>
          <InformationRow>
            <Show
              when={
                props.embed.proxiedIconURL && props.embed.type !== "Website"
              }
            >
              <Favicon
                loading="lazy"
                draggable={false}
                alt=""
                src={props.embed.proxiedIconURL}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </Show>
            <Title data-link={props.embed.url ? "" : undefined}>
              <RenderAnchor href={props.embed.url}>
                <OverflowingText>
                  {/* bot titles may hold emojis, custom ones as :id: */}
                  <Switch fallback={props.embed.title}>
                    <Match when={props.embed.type === "Text"}>
                      {renderSimpleMarkdown(props.embed.title!)}
                    </Match>
                  </Switch>
                </OverflowingText>
              </RenderAnchor>
            </Title>
          </InformationRow>
        </Show>

        <Show when={props.embed.description}>
          <Show
            when={props.embed.type === "Text"}
            fallback={<Description>{props.embed.description}</Description>}
          >
            <LongDescription text={props.embed.description!} />
          </Show>
        </Show>

        <For each={rows()}>
          {(row) => (
            <FieldRow
              style={{
                "grid-template-columns": `repeat(${row.length}, minmax(0, 1fr))`,
              }}
            >
              <For each={row}>
                {(field) => (
                  <Field>
                    <FieldName>{renderSimpleMarkdown(field.name)}</FieldName>
                    <Description>
                      <Markdown content={field.value} />
                    </Description>
                  </Field>
                )}
              </For>
            </FieldRow>
          )}
        </For>

        <Show
          when={
            props.embed.type === "Text" && (props.embed as TextEmbedClass).media
          }
        >
          <Attachment file={(props.embed as TextEmbedClass).media!} />
        </Show>

        <Show when={rich()?.proxiedImageURL}>
          {(src) => <EmbedImage src={src()} alt="" loading="lazy" />}
        </Show>

        <Show when={props.embed.type === "Website"}>
          <Switch>
            <Match
              when={isPlayerEmbed(
                (props.embed as WebsiteEmbed).specialContent?.type,
              )}
            >
              <SpecialEmbed embed={props.embed as WebsiteEmbed} />
            </Match>
            <Match when={(props.embed as WebsiteEmbed).video}>
              <SizedContent
                width={(props.embed as WebsiteEmbed).video!.width}
                height={(props.embed as WebsiteEmbed).video!.height}
              >
                <MediaPlayer
                  kind="video"
                  contextMenu={() => (
                    <MessageContextMenu
                      file={(props.embed as WebsiteEmbed).video!}
                    />
                  )}
                  src={(props.embed as WebsiteEmbed).video!.proxiedURL}
                />
              </SizedContent>
            </Match>
            <Match when={(props.embed as WebsiteEmbed).image?.size === "Large"}>
              <SizedContent
                width={(props.embed as WebsiteEmbed).image!.width}
                height={(props.embed as WebsiteEmbed).image!.height}
              >
                <img
                  src={(props.embed as WebsiteEmbed).image!.proxiedURL}
                  alt={t`Image`}
                  loading="lazy"
                  class={css({ cursor: "pointer" })}
                  use:floating={{
                    contextMenu: () => (
                      <MessageContextMenu
                        file={(props.embed as WebsiteEmbed).image!}
                      />
                    ),
                  }}
                  onClick={() =>
                    openModal({
                      type: "image_viewer",
                      embed: (props.embed as WebsiteEmbed).image!,
                    })
                  }
                />
              </SizedContent>
            </Match>
          </Switch>
        </Show>

        <Show when={rich()?.footer || rich()?.timestamp}>
          <Footer>
            <Show when={rich()?.proxiedFooterIconURL}>
              <SmallIcon
                loading="lazy"
                draggable={false}
                alt=""
                src={rich()!.proxiedFooterIconURL}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </Show>
            <span>
              {rich()?.footer?.text}
              <Show when={rich()?.footer?.text && rich()?.timestamp}>
                {" · "}
              </Show>
              <Show when={rich()?.timestamp}>
                <Time format="calendar" value={rich()!.timestamp!} />
              </Show>
            </span>
          </Footer>
        </Show>
      </Content>

      <Show when={rich()?.thumbnail}>
        {(thumbnail) => (
          <PreviewImage
            src={thumbnail().createFileURL()}
            alt=""
            loading="lazy"
            class={css({ cursor: "pointer" })}
            onClick={() =>
              openModal({ type: "image_viewer", file: thumbnail() })
            }
          />
        )}
      </Show>

      <Show when={rich()?.proxiedThumbnailURL}>
        {(src) => <PreviewImage src={src()} alt="" loading="lazy" />}
      </Show>

      <Show
        when={
          props.embed.type === "Website" &&
          (props.embed as WebsiteEmbed).image?.size === "Preview" &&
          !(props.embed as WebsiteEmbed).video
        }
      >
        <PreviewImage
          src={(props.embed as WebsiteEmbed).image!.proxiedURL}
          alt=""
          loading="lazy"
        />
      </Show>
    </Base>
  );
}
