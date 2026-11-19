import { Trans } from "@lingui/solid/macro";
import { Show } from "solid-js";
import { styled } from "styled-system/jsx";

import { useVoice } from "@revolt/rtc";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * The "weak connection" sign in a voice room: what the app did to keep the
 * call going (see rtc/weakNetwork.ts). Nothing shows on a good connection.
 */
export function WeakNetworkSign() {
  const voice = useVoice();
  return (
    <Show when={voice.network() !== "good"}>
      <Sign role="status" data-voice-network={voice.network()}>
        <Icon name="wifi-slash" size={18} />
        <Text>
          <Show
            when={voice.network() === "bad"}
            fallback={
              <Trans>Weak connection. Video is lowered to keep the call.</Trans>
            }
          >
            <Trans>
              Very weak connection. Video is paused, sound stays on.
            </Trans>
          </Show>
        </Text>
      </Sign>
    </Show>
  );
}

const Sign = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "36px",
    padding: "8px 12px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-nav, var(--z-bg-sidebar))",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-status-warning)",
  },
});

const Text = styled("span", {
  base: {
    minWidth: 0,
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 500,
    overflowWrap: "anywhere",
  },
});
