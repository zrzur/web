import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { canSend } from "@revolt/app/interface/channels/threadAccess";
import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import {
  Avatar,
  Dialog,
  DialogProps,
  TextField,
  useSnackbar,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

import {
  type TargetLike,
  forwardTargets,
  isMatureTarget,
} from "./forwardTargets";

/** Longest note the server takes */
const NOTE_MAX = 1000;

type Target = TargetLike & { channel: Channel };

/**
 * Forward a copy of a message to another conversation or channel, with an
 * optional note. The list holds the places this person can write in, most
 * recent first; arrow keys move through it from the search field.
 */
export function ForwardMessageModal(
  props: DialogProps & Modals & { type: "forward_message" },
) {
  const { t } = useLingui();
  const client = useClient();
  const snackbar = useSnackbar();

  const [query, setQuery] = createSignal("");
  const [selected, setSelected] = createSignal<string>();
  const [note, setNote] = createSignal("");
  const [error, setError] = createSignal<unknown>();
  const [sending, setSending] = createSignal(false);

  const sourceMature = () => {
    const channel = props.message.channel;
    return (
      !!channel &&
      isMatureTarget({
        mature: channel.mature,
        server: channel.server
          ? { name: channel.server.name, mature: channel.server.mature }
          : undefined,
      })
    );
  };

  const targets = createMemo(() =>
    forwardTargets<Target>(
      client()
        .channels.toList()
        .map((channel) => ({
          id: channel.id,
          type: channel.type,
          displayName: channel.displayName,
          server: channel.server
            ? { name: channel.server.name, mature: channel.server.mature }
            : undefined,
          active: channel.active,
          isForum: channel.isForum,
          mature: channel.mature,
          updatedAt: channel.updatedAt,
          canSend: canSend(channel),
          channel,
        })),
      query(),
      sourceMature(),
    ),
  );

  const selectedTarget = () =>
    targets().find((target) => target.id === selected());

  /** Move the choice up or down the list */
  function move(step: number) {
    const list = targets();
    if (!list.length) return;
    const index = list.findIndex((target) => target.id === selected());
    const next =
      index === -1
        ? step > 0
          ? 0
          : list.length - 1
        : Math.min(list.length - 1, Math.max(0, index + step));
    setSelected(list[next].id);
    document
      .getElementById(`forward-target-${list[next].id}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function onSearchKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      void send();
    }
  }

  async function send() {
    const target = selectedTarget();
    if (!target || sending()) return;
    setError(undefined);
    setSending(true);
    try {
      await props.message.forward(target.channel, note());
      props.onClose();
      snackbar.show({
        message: t`Forwarded to ${label(target)}`,
      });
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  /** Name shown for a destination */
  function label(target: Target) {
    return target.type === "SavedMessages"
      ? t`Saved notes`
      : (target.displayName ?? "");
  }

  /** Second line: where the destination is */
  function place(target: Target) {
    switch (target.type) {
      case "DirectMessage":
        return t`Direct message`;
      case "Group":
        return t`Group`;
      case "SavedMessages":
        return t`Only you`;
      default:
        return target.server?.name ?? "";
    }
  }

  const preview = () => {
    const content = (props.message.content ?? "").trim();
    if (content) return content;
    return props.message.attachments?.length ? t`Files only` : t`Embed only`;
  };

  return (
    <Dialog
      tone="info"
      iconName="arrow-bend-up-right"
      size="md"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Forward message</Trans>}
      description={
        <Trans>
          A copy goes to the place you choose. Nobody it mentions is notified.
        </Trans>
      }
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Forward</Trans>,
          onClick: () => {
            void send();
            return false;
          },
          isDisabled: !selectedTarget(),
          isLoading: sending(),
        },
      ]}
      isDisabled={sending()}
    >
      <Fields>
        <Preview data-testid="forward-preview">
          <PreviewAuthor>
            {props.message.username ?? props.message.author?.username}
          </PreviewAuthor>
          <PreviewText>{preview()}</PreviewText>
        </Preview>

        <TextField
          type="search"
          variant="filled"
          autoFocus
          value={query()}
          label={t`Send to`}
          placeholder={t`Search conversations and channels`}
          aria-controls="forward-targets"
          aria-activedescendant={
            selected() ? `forward-target-${selected()}` : undefined
          }
          onInput={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={onSearchKey}
        />

        <Targets
          id="forward-targets"
          role="listbox"
          aria-label={t`Destinations`}
          data-testid="forward-targets"
        >
          <For
            each={targets()}
            fallback={
              <Empty>
                <Trans>Nothing found. Try another name.</Trans>
              </Empty>
            }
          >
            {(target) => (
              <Option
                id={`forward-target-${target.id}`}
                type="button"
                role="option"
                aria-selected={selected() === target.id}
                onClick={() => setSelected(target.id)}
                onDblClick={() => {
                  setSelected(target.id);
                  void send();
                }}
              >
                <Show
                  when={target.type === "TextChannel"}
                  fallback={
                    <Avatar
                      size={32}
                      src={
                        target.type === "DirectMessage"
                          ? target.channel.recipient?.animatedAvatarURL
                          : target.type === "SavedMessages"
                            ? target.channel.user?.animatedAvatarURL
                            : target.channel.iconURL
                      }
                      fallback={label(target)}
                    />
                  }
                >
                  <ChannelMark aria-hidden="true">
                    <Icon name="hash" size={20} />
                  </ChannelMark>
                </Show>
                <OptionText>
                  <OptionName>{label(target)}</OptionName>
                  <OptionPlace>{place(target)}</OptionPlace>
                </OptionText>
                <Show when={selected() === target.id}>
                  <Icon name="check" size={20} />
                </Show>
              </Option>
            )}
          </For>
        </Targets>

        <TextField
          variant="filled"
          rows={2}
          autosize
          maxlength={NOTE_MAX}
          counter
          value={note()}
          label={t`Add a note (optional)`}
          onInput={(event) => setNote(event.currentTarget.value)}
        />

        <Show when={error()}>
          <Failure role="alert">
            <TranslatedError error={error()} />
          </Failure>
        </Show>
      </Fields>
    </Dialog>
  );
}

const Fields = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});

const Preview = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px",
    borderRadius: "var(--z-radius-md)",
    background: "var(--z-bg-raised)",
    borderInlineStart: "4px solid var(--z-border-strong)",
    minWidth: 0,
  },
});

const PreviewAuthor = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

const PreviewText = styled("span", {
  base: {
    fontSize: "14px",
    color: "var(--z-fg-primary)",
    lineClamp: 2,
    wordBreak: "break-word",
  },
});

const Targets = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxHeight: "280px",
    overflowY: "auto",
    padding: "4px",
    borderRadius: "var(--z-radius-md)",
    border: "1px solid var(--z-border-subtle)",
    _phone: { maxHeight: "40vh" },
  },
});

const Option = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    paddingBlock: "8px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "var(--z-radius-sm)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-muted)",

    "&:hover": { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    "&[aria-selected='true']": {
      background: "var(--z-nav-selected)",
      boxShadow: "inset 0 0 0 2px var(--z-accent)",
      "--z-icon-color": "var(--z-accent)",
    },
  },
});

const ChannelMark = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "32px",
    height: "32px",
    borderRadius: "var(--z-radius-sm)",
    background: "var(--z-bg-raised)",
  },
});

const OptionText = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
  },
});

const OptionName = styled("span", {
  base: {
    fontSize: "14px",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const OptionPlace = styled("span", {
  base: {
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    padding: "12px",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
  },
});

const Failure = styled("div", {
  base: {
    color: "var(--z-danger)",
    fontSize: "14px",
  },
});
