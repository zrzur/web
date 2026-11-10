import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { MessageContextMenu, useMessage } from "@revolt/app";
import { editableByMe } from "@revolt/app/interface/channels/text/editable";
import {
  canSend,
  threadIsReadOnly,
} from "@revolt/app/interface/channels/threadAccess";
import { useClient, useUser } from "@revolt/client";
import { useModals } from "@revolt/modal";
import {
  canForwardMessage,
  forwardingEnabled,
} from "@revolt/modal/modals/forwardTargets";
import { useState } from "@revolt/state";
import { Icon } from "@revolt/ui/icons/Icon";

export function MessageToolbar() {
  const user = useUser();
  const client = useClient();
  const state = useState();
  const { openModal } = useModals();
  const { message, reactPicker } = useMessage();
  const { t } = useLingui();

  let reactRef: HTMLButtonElement | undefined;

  function deleteMessage(ev: MouseEvent) {
    if (ev.shiftKey) {
      message?.delete();
    } else if (message) {
      openModal({
        type: "delete_message",
        message: message,
      });
    }
  }

  const tip = (content: string) => ({
    tooltip: { placement: "top" as const, content },
  });

  return (
    <Base class="Toolbar" role="toolbar" aria-label={t`Message actions`}>
      <Show
        when={
          message?.channel?.havePermission("React") &&
          !threadIsReadOnly(message.channel)
        }
      >
        <button
          type="button"
          ref={reactRef}
          class={tool()}
          aria-label={t`Add reaction`}
          use:floating={tip(t`Add reaction`)}
          onClick={(e) =>
            reactPicker!()?.onClickEmoji(
              e,
              reactRef as unknown as HTMLDivElement,
            )
          }
        >
          <Icon name="smiley" size={20} />
        </button>
      </Show>
      <Show when={message?.channel && canSend(message.channel)}>
        <button
          type="button"
          class={tool()}
          aria-label={t`Reply`}
          use:floating={tip(t`Reply`)}
          onClick={() => state.draft.addReply(message!, user()!.id)}
        >
          <Icon name="arrow-bend-up-left" size={20} />
        </button>
      </Show>
      <Show
        when={
          message &&
          !message.author?.official &&
          forwardingEnabled(client()) &&
          canForwardMessage(message)
        }
      >
        <button
          type="button"
          class={tool({ mirror: true })}
          aria-label={t`Forward`}
          use:floating={tip(t`Forward`)}
          onClick={() =>
            openModal({ type: "forward_message", message: message! })
          }
        >
          <Icon name="arrow-bend-up-right" size={20} />
        </button>
      </Show>
      <Show
        when={
          !!message &&
          editableByMe(message) &&
          message.channel &&
          canSend(message.channel)
        }
      >
        <button
          type="button"
          class={tool()}
          aria-label={t`Edit`}
          use:floating={tip(t`Edit`)}
          onClick={() => state.draft.setEditingMessage(message)}
        >
          <Icon name="pencil-simple" size={20} />
        </button>
      </Show>
      <Show
        when={
          message?.author?.self ||
          message?.channel?.havePermission("ManageMessages")
        }
      >
        <button
          type="button"
          class={tool({ danger: true })}
          aria-label={t`Delete`}
          use:floating={tip(t`Delete (Shift to skip confirmation)`)}
          onClick={deleteMessage}
        >
          <Icon name="trash" size={20} />
        </button>
      </Show>
      <button
        type="button"
        class={tool()}
        aria-label={t`More`}
        aria-haspopup="menu"
        use:floating={{
          tooltip: { placement: "top", content: t`More` },
          contextMenu: () => (
            <MessageContextMenu message={message!} reactPicker={reactPicker} />
          ),
          contextMenuHandler: "click",
        }}
      >
        <Icon name="dots-three" size={20} />
      </button>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    // phones: no hover row; the same actions are in the long-press sheet
    _phone: { display: "none !important" },
    top: "-16px",
    insetInlineEnd: "16px",
    position: "absolute",
    zIndex: 2,

    alignItems: "center",
    gap: "2px",
    padding: "2px",

    display: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    boxShadow: "var(--z-popover-lift)",
    border: "1px solid var(--z-popover-border)",
    background: "var(--z-popover-bg)",
  },
});

const tool = cva({
  base: {
    width: "32px",
    height: "32px",
    padding: 0,
    border: "none",
    borderRadius: "var(--z-shape-chip, 6px)",
    background: "transparent",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    "--z-icon-color": "var(--z-icon-muted)",
    transition: "color 120ms ease, background-color 120ms ease",
    _motionReduce: { transition: "none" },

    "&:hover": {
      "--z-icon-color": "var(--z-icon-active)",
      background: "var(--z-nav-hover)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
  },
  variants: {
    /** arrows that point a way turn round in right-to-left text */
    mirror: {
      true: {
        "&:dir(rtl) svg": { transform: "scaleX(-1)" },
      },
    },
    danger: {
      true: {
        "&:hover": {
          "--z-icon-color": "var(--z-icon-danger)",
        },
      },
    },
  },
});
