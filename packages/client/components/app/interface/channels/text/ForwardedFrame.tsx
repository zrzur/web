import { JSX, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { MessageForward } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useTime } from "@revolt/i18n";
import { Markdown } from "@revolt/markdown";
import { useNavigate } from "@revolt/routing";
import { Icon } from "@revolt/ui/icons/Icon";

import { originLink } from "./forwardOrigin";

/**
 * A forwarded copy: the forwarder's note on top, then the copied text,
 * files and embeds in a frame marked "Forwarded", with a link back to the
 * original when this reader can open its channel. Messages that were not
 * forwarded pass through unchanged.
 */
export function ForwardedFrame(props: {
  origin?: MessageForward;
  children: JSX.Element;
}) {
  return (
    <Show when={props.origin} fallback={props.children}>
      {(origin) => <Frame origin={origin()}>{props.children}</Frame>}
    </Show>
  );
}

function Frame(props: { origin: MessageForward; children: JSX.Element }) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const dayjs = useTime();

  const link = () =>
    originLink(props.origin, (id) => client().channels.get(id));

  // Unicode isolates keep a Latin place name or date in one piece inside Arabic text
  const sentAt = () => `⁨${dayjs(props.origin.sent_at).format("LLL")}⁩`;

  return (
    <>
      <Show when={props.origin.note}>
        <Note>
          <Markdown content={props.origin.note!} />
        </Note>
      </Show>
      <Box data-testid="forwarded-message">
        <Header>
          <Icon name="arrow-bend-up-right" size={16} />
          <Trans>Forwarded</Trans>
        </Header>
        {props.children}
        <Footer>
          <Show when={link()} fallback={<span>{t`Sent ${sentAt()}`}</span>}>
            {(target) => (
              <OriginLink
                type="button"
                data-testid="forwarded-origin"
                onClick={() => navigate(target().path)}
              >
                {t`From ${`⁨${target().place}⁩`} · ${sentAt()}`}
              </OriginLink>
            )}
          </Show>
        </Footer>
      </Box>
    </>
  );
}

const Note = styled("div", {
  base: {
    wordBreak: "break-word",
    marginBlockEnd: "4px",
  },
});

const Box = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    paddingBlock: "4px",
    paddingInlineStart: "12px",
    borderInlineStart: "4px solid var(--z-border-strong)",
    wordBreak: "break-word",
  },
});

const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-muted)",
    "&:dir(rtl) svg": { transform: "scaleX(-1)" },
  },
});

const Footer = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const OriginLink = styled("button", {
  base: {
    all: "unset",
    cursor: "pointer",
    color: "var(--z-link)",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    borderRadius: "var(--z-radius-xs)",
    "&:hover": { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});
