import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Button } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { NewTicket } from "../settings/user/support/ContactSupport";

/**
 * Takes the place of the message box in the conversation with Zrzur's
 * official account: nobody can write there, so it points to a ticket that
 * answers the newest official message.
 */
export function OfficialBanner(props: { channel: Channel }) {
  const { t } = useLingui();
  const client = useClient();
  const [writing, setWriting] = createSignal(false);

  /** The newest official message, to link the ticket to it */
  const latest = () => {
    const id = props.channel.lastMessageId;
    return id ? client().messages.get(id) : undefined;
  };
  /** Its first line without markdown, as the ticket subject */
  const subject = () => {
    const first = latest()?.content?.split("\n")[0]?.replace(/\*/g, "").trim() ?? "";
    return first ? t`Re: ${first}`.slice(0, 120) : "";
  };

  return (
    <Banner role="note">
      <Shield aria-hidden="true">
        <Icon name="shield-check" size={28} />
      </Shield>
      <Text>
        <strong>
          <Trans>Only official messages from the Zrzur team arrive here.</Trans>
        </strong>
        <span>
          <Trans>To answer one, open a ticket.</Trans>
        </span>
      </Text>
      <Button onPress={() => setWriting(true)}>
        <Trans>Reply in a ticket</Trans>
      </Button>
      <Show when={writing()}>
        <NewTicket
          related={latest()?.id}
          subject={subject()}
          onClose={() => setWriting(false)}
          onDone={() => setWriting(false)}
        />
      </Show>
    </Banner>
  );
}

const Banner = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    margin: "0 16px 16px",
    padding: "12px 16px",
    borderRadius: "12px",
    background: "var(--z-surface-raised, var(--md-sys-color-surface-container-high))",
    border: "1px solid var(--z-border, var(--md-sys-color-outline-variant))",
    "@media (max-width: 600px)": {
      "& > button": { width: "100%", minHeight: "44px" },
    },
  },
});

const Shield = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    color: "var(--z-accent, var(--md-sys-color-primary))",
    flexShrink: 0,
  },
});

const Text = styled("div", {
  base: {
    display: "grid",
    gap: "2px",
    flex: "1 1 240px",
    minWidth: 0,
    "& strong": { fontSize: "15px", color: "var(--z-fg, var(--md-sys-color-on-surface))" },
    "& span": { fontSize: "13px", color: "var(--z-fg-secondary, var(--md-sys-color-on-surface-variant))" },
  },
});
