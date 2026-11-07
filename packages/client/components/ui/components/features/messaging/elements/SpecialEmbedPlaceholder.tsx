import { Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Button } from "@revolt/ui/components/design";

import { playersPolicyUrl } from "./embedSettings";

/**
 * Shown instead of a third-party player until the reader chooses to load it.
 * Nothing here contacts the provider: the picture, if any, comes through our
 * own proxy.
 */
export function SpecialEmbedPlaceholder(props: {
  provider: string;
  company: string;
  title?: string;
  /** thumbnail already proxied by us (never the provider's own URL) */
  thumbnail?: string;
  onLoad: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const policy = () =>
    playersPolicyUrl(
      client()?.configuration?.features?.legal_links?.privacy_policy,
    );

  const label = () => {
    const provider = props.provider;
    const title = props.title;
    return title
      ? t`Load ${provider} player: ${title}`
      : t`Load ${provider} player`;
  };

  return (
    <Box data-testid="player-placeholder">
      <Show when={props.thumbnail}>
        <Thumb src={props.thumbnail} alt="" loading="lazy" draggable={false} />
        <Shade />
      </Show>
      <Info>
        <Provider>{props.provider}</Provider>
        <Show when={props.title}>
          <Name dir="auto">{props.title}</Name>
        </Show>
        <Note dir="auto">
          <Trans>
            Loading this connects to {props.company}. They get your IP address
            and may store cookies.
          </Trans>{" "}
          <a href={policy()} target="_blank" rel="noopener noreferrer">
            <Trans>Privacy policy</Trans>
          </a>
        </Note>
        <Action>
          <Button onPress={props.onLoad} aria-label={label()}>
            <Trans>Load</Trans>
          </Button>
        </Action>
      </Info>
    </Box>
  );
}

const Box = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: 0,
    overflowY: "auto",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
  },
});

const Thumb = styled("img", {
  base: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
});

/** Dark layer over the picture so the text always reaches AA contrast */
const Shade = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    background:
      "color-mix(in srgb, var(--z-bg-rail, var(--z-bg-raised)) 90%, transparent)",
  },
});

const Info = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "flex-start",
    justifyContent: "center",
    flexGrow: 1,
    padding: "16px",
    "@media (max-width: 600px)": { padding: "12px", gap: "4px" },
  },
});

const Provider = styled("span", {
  base: { fontWeight: 600, color: "var(--z-fg-secondary)" },
});

const Name = styled("strong", {
  base: {
    overflowWrap: "anywhere",
    lineClamp: 2,
  },
});

const Note = styled("span", {
  base: {
    color: "var(--z-fg-primary)",
    "& a": {
      color: "var(--z-link, var(--z-fg-primary))",
      textDecoration: "underline",
    },
  },
});

const Action = styled("div", {
  base: {
    flexShrink: 0,
    "@media (max-width: 600px)": {
      width: "100%",
      "& button": { width: "100%", minHeight: "44px" },
    },
  },
});
