import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { A, useLocation } from "@revolt/routing";
import { Icon } from "@revolt/ui/icons/Icon";
import { RulesIcon } from "@revolt/ui/icons/RulesIcon";

/** The Lobby row shows only once a manager turns the lobby on */
export function lobbyRowShown(server: Pick<Server, "lobby">): boolean {
  return server.lobby?.enabled === true;
}

/**
 * "Lobby" row at the top of the channel list, for everyone, once a manager
 * turns the lobby on in Server settings (off in every new server). Managers
 * edit and preview it from the settings while it is off.
 */
export function LobbyLink(props: { server: Server }) {
  const { t } = useLingui();
  const location = useLocation();
  const href = () => `/server/${props.server.id}/lobby`;

  return (
    <Show when={lobbyRowShown(props.server)}>
      <Row
        href={href()}
        aria-current={location.pathname.endsWith("/lobby") ? "page" : undefined}
      >
        <Icon name="house" size={20} />
        <span>{t`Lobby`}</span>
      </Row>
    </Show>
  );
}

/**
 * "Rules" row pinned at the top of the channel list, under the Lobby, when
 * the server has a rules channel you can read.
 */
export function RulesLink(props: { server: Server }) {
  const { t } = useLingui();
  const location = useLocation();
  const channel = () => {
    const rules = props.server.rulesChannel;
    return rules?.havePermission("ViewChannel") ? rules : undefined;
  };

  return (
    <Show when={channel()}>
      {(rules) => (
        <Row
          href={`/server/${props.server.id}/channel/${rules().id}`}
          aria-current={
            location.pathname.endsWith(`/channel/${rules().id}`)
              ? "page"
              : undefined
          }
          data-tight=""
        >
          <RulesIcon size={20} />
          <span>{t`Rules`}</span>
        </Row>
      )}
    </Show>
  );
}

const Row = styled(A, {
  base: {
    display: "flex",
    alignItems: "center",
    // the same row as Events above it (owner, 2026-11-20: tidy, no gap):
    // 12px icon gap and padding, 2px between pinned rows, 8px above the first
    gap: "12px",
    // the same row as a channel: height and the 8 px padding that puts the
    // icon on the list's start line
    minHeight: "var(--z-row-height, 34px)",
    marginInline: "8px",
    marginBlock: "2px",
    "&:first-child": { marginBlockStart: "8px" },
    paddingInline: "8px",
    borderRadius: "8px",
    color: "var(--z-fg-secondary)",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[aria-current=page]": {
      background: "var(--z-nav-active)",
      color: "var(--z-fg-primary)",
    },
    _phone: { minHeight: "44px" },
  },
});
