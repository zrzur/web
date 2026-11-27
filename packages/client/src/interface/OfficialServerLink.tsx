import { Match, Show, Switch } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import { isDesignsSite, isDiscoverSite, isDocsSite } from "../siteKind";

/** The official server each part of Zrzur has, by its short link */
export const OFFICIAL_SERVER_CODE = {
  designs: "designs",
  discover: "discover",
  developers: "developers",
} as const;

export type OfficialServer = keyof typeof OFFICIAL_SERVER_CODE;

/**
 * "Questions? Ask in the Zrzur Designs server.": the line at the end of
 * Designs, Discover and the developer docs inside the app. The link opens
 * the server's invite. On the public sites the footer carries the same link.
 */
export function OfficialServerLink(props: { server: OfficialServer }) {
  const onSite = () => isDesignsSite() || isDiscoverSite() || isDocsSite();
  const href = () => `/invite/${OFFICIAL_SERVER_CODE[props.server]}`;
  return (
    <Show when={!onSite()}>
      <Line data-official-server={props.server}>
        <Icon name="chats-circle" size={18} />
        <span>
          <Switch>
            <Match when={props.server === "designs"}>
              <Trans>
                Questions about designs? Ask in the{" "}
                <a href={href()}>Zrzur Designs server</a>.
              </Trans>
            </Match>
            <Match when={props.server === "discover"}>
              <Trans>
                Questions about Discover? Ask in the{" "}
                <a href={href()}>Zrzur Discover server</a>.
              </Trans>
            </Match>
            <Match when={props.server === "developers"}>
              <Trans>
                Questions about building on Zrzur? Ask in the{" "}
                <a href={href()}>Zrzur Developers server</a>.
              </Trans>
            </Match>
          </Switch>
        </span>
      </Line>
    </Show>
  );
}

const Line = styled("p", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    margin: 0,
    paddingBlock: "24px 32px",
    paddingInline: "16px",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    textAlign: "center",
    "--z-icon-color": "currentColor",
    "& a": {
      color: "var(--z-link)",
      fontWeight: 600,
      textDecoration: "none",
      _hover: { textDecoration: "underline" },
      _focusVisible: {
        outline: "2px solid var(--z-focus, var(--z-accent))",
        outlineOffset: "2px",
        borderRadius: "4px",
      },
    },
  },
});
