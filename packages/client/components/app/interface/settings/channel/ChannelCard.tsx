import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { TextWithEmoji } from "@revolt/markdown";
import { OverflowingText } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Top of the channel settings sidebar, matching the server settings card:
 * which channel you're editing and what kind it is
 */
export function ChannelCard(props: { channel: Channel }) {
  return (
    <Card>
      <Glyph>
        <Show
          when={props.channel.iconURL}
          fallback={
            <Icon
              name={props.channel.isVoiceRoom ? "speaker-high" : "hash"}
              size={20}
            />
          }
        >
          <img src={props.channel.iconURL} alt="" />
        </Show>
      </Glyph>
      <Names>
        <Name>
          <OverflowingText>
            <TextWithEmoji content={props.channel.name ?? ""} />
          </OverflowingText>
        </Name>
        <Sub>
          <Show
            when={props.channel.isVoiceRoom}
            fallback={<Trans>Channel settings</Trans>}
          >
            <Trans>Voice channel settings</Trans>
          </Show>
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
    minHeight: "56px",
    padding: "8px",
    marginInlineEnd: "12px",
    marginBottom: "4px",
  },
});

const Glyph = styled("div", {
  base: {
    flexShrink: 0,
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",

    "& img": {
      borderRadius: "10px",
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
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
