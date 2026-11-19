import { type JSX, For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Avatar, IconButton } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Body, Line, Preview, When, Where } from "./MentionsPanel";

/**
 * One message in the saved list or the reminders: who wrote it, where, its
 * words and its files, with its own actions at the end of the row. Selecting
 * the message jumps to it. A message that is gone, or closed to the person,
 * is drawn as one quiet line: the server sends nothing of it.
 *
 * [avatar] Name                         note   [action] [action]
 *          Server · #channel
 *          words of the message…
 *          [clip] file.png +2
 */
export function InboxEntry(props: {
  message: Message | undefined;
  /** Short line at the end of the name row (a time) */
  note?: JSX.Element;
  /** Icon buttons at the end of the row */
  actions: JSX.Element;
  onOpen: (message: Message) => void;
  testId?: string;
}) {
  const { t } = useLingui();
  const client = useClient();

  // server and channel apart: an Arabic name beside a Latin one must not
  // swap their order
  const place = (message: Message): string[] => {
    const channel = message.channel;
    if (!channel) return [];
    if (channel.type === "DirectMessage") return [t`Direct message`];
    const name =
      channel.type === "SavedMessages" ? t`Saved notes` : `#${channel.name}`;
    return channel.server ? [channel.server.name, name] : [name];
  };

  const files = (message: Message) =>
    (message.attachments ?? []).map((file) => file.filename ?? t`File`);

  return (
    <Row
      data-testid={props.testId}
      data-unavailable={!props.message || undefined}
    >
      <Show
        when={props.message}
        fallback={
          <Gone>
            <Icon name="eye-slash" size={20} />
            <span>
              <Trans>This message is no longer available.</Trans>
            </span>
          </Gone>
        }
      >
        {(message) => (
          <Main type="button" onClick={() => props.onOpen(message())}>
            <Avatar
              size={36}
              src={message().animatedAvatarURL}
              fallback={message().username}
            />
            <Body>
              <Line>
                <strong
                  dir="auto"
                  style={{ color: message().roleColour ?? undefined }}
                >
                  {message().username}
                </strong>
                <Show when={props.note}>
                  <When>{props.note}</When>
                </Show>
              </Line>
              <Where>
                <For each={place(message())}>
                  {(part, index) => (
                    <>
                      {index() > 0 ? " · " : ""}
                      <bdi>{part}</bdi>
                    </>
                  )}
                </For>
              </Where>
              <Show when={message().content}>
                <Preview>
                  <bdi>{client().markdownToText(message().content)}</bdi>
                </Preview>
              </Show>
              <Show when={files(message()).length}>
                <Files>
                  <Icon name="paperclip" size={16} />
                  <bdi>{files(message())[0]}</bdi>
                  <Show when={files(message()).length > 1}>
                    <span>+{files(message()).length - 1}</span>
                  </Show>
                </Files>
              </Show>
            </Body>
          </Main>
        )}
      </Show>
      <Actions>{props.actions}</Actions>
    </Row>
  );
}

/** An icon button at the end of an entry */
export function EntryAction(props: {
  icon: "x" | "clock" | "pencil-simple" | "check";
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <IconButton
      variant="standard"
      size="sm"
      aria-label={props.label}
      isDisabled={props.disabled}
      data-testid={props.testId}
      onPress={props.onPress}
    >
      <Icon name={props.icon} size={20} />
    </IconButton>
  );
}

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "4px",
    flexShrink: 0,
    padding: "4px",
    border: "1px solid var(--z-card-border, var(--z-border-soft))",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    background: "var(--z-card-bg)",
  },
});

const Main = styled("button", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    flex: 1,
    minWidth: 0,
    padding: "8px",
    border: "none",
    borderRadius: "var(--z-radius, 10px)",
    background: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    _active: { background: "var(--z-nav-selected)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const Gone = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: 1,
    minWidth: 0,
    minHeight: "44px",
    padding: "8px",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});

const Files = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    marginBlockStart: "4px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-neutral)",
    "& bdi": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& span": { flexShrink: 0 },
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    paddingBlockStart: "4px",
  },
});

/** Title row of a list on phones: the title and the close button */
export const TitleRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
});

/** Small heading over a group of entries */
export const Section = styled("h3", {
  base: {
    margin: "8px 4px 0",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});
