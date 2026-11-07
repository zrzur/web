import { Trans } from "@lingui/solid/macro";
import { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { Avatar, OverflowingText } from "@revolt/ui";

/**
 * Top of the server settings sidebar, the counterpart of the account card in
 * user settings: which server you're editing
 */
export function ServerCard(props: { server: Server }) {
  return (
    <Card>
      <Avatar
        size={36}
        shape="rounded-square"
        src={props.server.animatedIconURL}
        fallback={props.server.name}
      />
      <Names>
        <Name>
          <OverflowingText>{props.server.name}</OverflowingText>
        </Name>
        <Sub>
          <Trans>Server settings</Trans>
        </Sub>
      </Names>
    </Card>
  );
}

const Card = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "48px",
    padding: "8px",
    marginInlineEnd: "12px",
    marginBottom: "4px",
  },
});

const Names = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
});

const Name = styled("span", {
  base: {
    minWidth: 0,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "18px",
    color: "var(--z-fg-primary)",
  },
});

const Sub = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});
