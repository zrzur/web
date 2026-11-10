import { Show, createResource } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { fetchStreamPreview } from "@zrzur/sdk/solid/voiceExtras";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";

import { previewOf } from "./streamPreviewCache";

/**
 * A still of someone's screen share, shown while you hover them in the
 * channel list before joining. Lazy, and it asks for the still only once it
 * is on screen (at most every 30 seconds per share).
 */
export default function StreamPreviewCard(props: {
  channel: Channel;
  userId: string;
  name: string;
}) {
  const { t } = useLingui();
  const client = useClient();
  const [still] = createResource(
    () => [props.channel, props.userId] as const,
    ([channel, userId]) =>
      previewOf(channel.id, userId, () =>
        fetchStreamPreview(client(), channel, userId),
      ),
  );

  return (
    <Card data-stream-preview={props.userId} role="tooltip">
      <Show
        when={still()}
        fallback={
          <Empty>
            <Show when={!still.loading} fallback={<Trans>Loading…</Trans>}>
              <Trans>No preview yet</Trans>
            </Show>
          </Empty>
        }
      >
        {(url) => (
          <img
            src={url()}
            width={320}
            height={180}
            alt={t`Screen of ${props.name}`}
            decoding="async"
          />
        )}
      </Show>
      <Live>
        <Trans>Sharing their screen</Trans>
      </Live>
    </Card>
  );
}

const Card = styled("div", {
  base: {
    position: "absolute",
    insetInlineStart: "8px",
    bottom: "calc(100% + 4px)",
    zIndex: 20,
    width: "min(240px, calc(100vw - 32px))",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    boxShadow: "var(--z-shadow-md)",
    pointerEvents: "none",
    "& img": {
      display: "block",
      width: "100%",
      height: "auto",
      aspectRatio: "16 / 9",
      objectFit: "contain",
      borderRadius: "6px",
      background: "var(--z-bg-sunken, black)",
    },
  },
});

const Empty = styled("div", {
  base: {
    aspectRatio: "16 / 9",
    display: "grid",
    placeItems: "center",
    padding: "12px",
    borderRadius: "6px",
    background: "var(--z-bg-sunken, var(--z-bg-input))",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    textAlign: "center",
  },
});

const Live = styled("span", {
  base: {
    paddingInline: "4px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});
