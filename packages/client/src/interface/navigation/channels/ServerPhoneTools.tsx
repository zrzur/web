import { Show, createMemo } from "solid-js";

import { Plural, useLingui } from "@lingui/solid/macro";
import { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Phones, under the server's name (design approved by the owner, 2026-11-16):
 * how many members the server has, a field that narrows the channel list as
 * you type, and a button that makes an invite.
 */
export function ServerPhoneTools(props: {
  server: Server;
  query: string;
  setQuery: (value: string) => void;
}) {
  const { t } = useLingui();
  const { openModal } = useModals();

  /** the first channel this member may invite people to */
  const inviteChannel = createMemo(() =>
    props.server.channels.find(
      (channel) => !channel.isVoice && channel.havePermission("InviteOthers"),
    ),
  );

  return (
    <Base data-server-phone-tools>
      <Show when={props.server.approximateMemberCount}>
        <Count>
          <Plural
            value={props.server.approximateMemberCount}
            one="# member"
            other="# members"
          />
        </Count>
      </Show>
      <Tools>
        <SearchField>
          <Icon name="magnifying-glass" size={20} />
          <input
            type="search"
            value={props.query}
            placeholder={t`Search channels`}
            aria-label={t`Search channels`}
            onInput={(event) => props.setQuery(event.currentTarget.value)}
          />
        </SearchField>
        <Show when={inviteChannel()}>
          <ToolButton
            type="button"
            aria-label={t`Create invite`}
            onClick={() =>
              openModal({ type: "create_invite", channel: inviteChannel()! })
            }
          >
            <Icon name="user-plus" size={22} />
          </ToolButton>
        </Show>
      </Tools>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    flex: "none",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    // room under the header line: the count used to sit right against it
    padding: "12px 16px 12px",
    borderBottom: "1px solid var(--z-border-subtle)",
  },
});

const Count = styled("div", {
  base: {
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const Tools = styled("div", {
  base: {
    display: "flex",
    gap: "10px",
  },
});

const SearchField = styled("label", {
  base: {
    flex: 1,
    minWidth: 0,
    height: "44px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingInline: "12px",
    borderRadius: "12px",
    color: "var(--z-fg-muted)",
    background: "var(--z-bg-input, var(--z-bg-raised))",
    "--z-icon-color": "currentColor",
    "& input": {
      flex: 1,
      minWidth: 0,
      height: "100%",
      border: "none",
      outline: "none",
      background: "none",
      color: "var(--z-fg-primary)",
      font: "inherit",
    },
    "&:focus-within": { boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});

const ToolButton = styled("button", {
  base: {
    flex: "none",
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    color: "var(--z-fg-secondary, var(--z-fg-primary))",
    background: "var(--z-bg-input, var(--z-bg-raised))",
    "--z-icon-color": "currentColor",
    _focusVisible: { outline: "none", boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});
