import { Show, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Icon } from "@revolt/ui/icons/Icon";

/** The ticket this user has open in a server, if any */
export function myOpenTicket(server: Server, userId: string | undefined) {
  if (!userId) return undefined;
  return server.channels.find(
    (channel) =>
      channel.ticket?.openerId === userId && channel.ticket.closed === false,
  );
}

/**
 * "Open a ticket" row at the top of a server's channel list, in a server
 * whose managers switched tickets on. It opens a private channel with the
 * server's staff; with a ticket already open it leads to that one.
 */
export function TicketLink(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const state = useState();
  const { showError } = useModals();
  const [pending, setPending] = createSignal(false);

  const shown = () => props.server.tickets?.enabled === true;
  const mine = () => myOpenTicket(props.server, client().user?.id);

  const go = (channelId: string) => {
    navigate(`/server/${props.server.id}/channel/${channelId}`);
    // phones: like a channel, opening it slides the channel list away
    state.appDrawer()?.setShown(true);
  };

  async function open() {
    const ticket = mine();
    if (ticket) return go(ticket.id);
    if (pending()) return;
    setPending(true);
    try {
      go((await props.server.openTicket()).id);
    } catch (error) {
      showError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Show when={shown()}>
      <Row
        type="button"
        data-testid="ticket-link"
        data-mine={mine() ? "" : undefined}
        aria-busy={pending() || undefined}
        title={t`A private channel between you and the staff of this server.`}
        onClick={() => void open()}
      >
        <Icon name="ticket" size={20} />
        <Label>{mine() ? t`Your ticket` : t`Open a ticket`}</Label>
      </Row>
    </Show>
  );
}

const Row = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "calc(100% - 16px)",
    minHeight: "36px",
    marginInline: "8px",
    marginBlock: "4px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    fontFamily: "inherit",
    fontSize: "15px",
    fontWeight: 600,
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[aria-busy]": { opacity: 0.6, cursor: "progress" },
    _phone: { minHeight: "44px" },
  },
});

/** The row's name takes the free space; the icon keeps its size */
const Label = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
