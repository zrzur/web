import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { A, useLocation } from "@revolt/routing";
import { Icon } from "@revolt/ui/icons/Icon";
import { RulesIcon } from "@revolt/ui/icons/RulesIcon";

/**
 * "Lobby" row at the top of the channel list, when the server has one.
 * Managers also see it while the lobby is off, so they can find it.
 */
export function LobbyLink(props: { server: Server }) {
  const { t } = useLingui();
  const location = useLocation();
  const href = () => `/server/${props.server.id}/lobby`;
  const visible = () =>
    props.server.lobby?.enabled || props.server.havePermission("ManageServer");

  return (
    <Show when={visible()}>
      <Row
        href={href()}
        aria-current={location.pathname.endsWith("/lobby") ? "page" : undefined}
        data-off={props.server.lobby?.enabled ? undefined : ""}
        title={
          props.server.lobby?.enabled
            ? undefined
            : t`Only managers see this until the lobby is turned on.`
        }
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
    gap: "10px",
    minHeight: "36px",
    marginInline: "8px",
    marginBlock: "8px 2px",
    paddingInline: "10px",
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
    // off: the words stay readable, the picture fades
    "&[data-off]": {
      color: "var(--z-fg-muted)",
      "& > svg": { opacity: 0.6 },
    },
    // the second pinned row sits right under the first
    "&[data-tight]": { marginBlockStart: "2px" },
    _phone: { minHeight: "44px" },
  },
});
