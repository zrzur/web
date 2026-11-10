import { Show, createResource } from "solid-js";
import { render } from "solid-js/web";

import { t } from "@lingui/core/macro";
import type { Channel, Client } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { fetchStreamPreview } from "@revolt/rtc/voiceExtrasStore";

import { previewOf } from "./streamPreviewCache";

/**
 * A still of someone's screen share, shown while you hover them in the
 * channel list before joining. It asks for the still only once it is on
 * screen (at most every 30 seconds per share).
 */
export function StreamPreviewCard(props: {
  client: Client;
  channel: Channel;
  userId: string;
  name: string;
}) {
  const [still] = createResource(
    () => [props.channel, props.userId] as const,
    ([channel, userId]) =>
      previewOf(channel.id, userId, () =>
        fetchStreamPreview(props.client, channel, userId),
      ),
  );

  return (
    <Card data-stream-preview={props.userId} role="tooltip">
      <Show
        when={still()}
        fallback={
          <Empty>{still.loading ? t`Loading…` : t`No preview yet`}</Empty>
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
      <Live>{t`Sharing their screen`}</Live>
    </Card>
  );
}

/**
 * Show the card on a row of the channel list until the pointer or the
 * focus leaves it (loaded with the first hover, not with the app)
 */
export function show(
  row: HTMLElement,
  client: Client,
  channel: Channel,
  userId: string,
  name: string,
): (() => void) | undefined {
  if (row.querySelector("[data-stream-preview]")) return;
  const holder = document.createElement("div");
  row.append(holder);
  const dispose = render(
    () => (
      <StreamPreviewCard
        client={client}
        channel={channel}
        userId={userId}
        name={name}
      />
    ),
    holder,
  );
  let hidden = false;
  const hide = () => {
    if (hidden) return;
    hidden = true;
    dispose();
    holder.remove();
    row.removeEventListener("pointerleave", hide);
    row.removeEventListener("focusout", hide);
  };
  row.addEventListener("pointerleave", hide);
  row.addEventListener("focusout", hide);
  return hide;
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
    borderRadius: "var(--z-radius)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-popover)",
    boxShadow: "var(--z-shadow-md)",
    pointerEvents: "none",
    "& img": {
      display: "block",
      width: "100%",
      height: "auto",
      aspectRatio: "16 / 9",
      objectFit: "contain",
      borderRadius: "var(--z-radius-sm)",
      background: "var(--z-bg-input)",
    },
  },
});

const Empty = styled("div", {
  base: {
    aspectRatio: "16 / 9",
    display: "grid",
    placeItems: "center",
    padding: "12px",
    borderRadius: "var(--z-radius-sm)",
    background: "var(--z-bg-input)",
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
