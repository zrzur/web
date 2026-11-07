import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useError } from "@revolt/i18n";
import { useNavigate } from "@revolt/routing";
import { Button } from "@revolt/ui";
import { RulesIcon } from "@revolt/ui/icons/RulesIcon";

/**
 * Rules screening: someone who joined after it was switched on accepts the
 * server rules before they can write. Shown above the message box.
 */
export function RulesGate(props: { server: Server }) {
  const describeError = useError();
  const navigate = useNavigate();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function accept() {
    setPending(true);
    setError(undefined);
    try {
      await props.server.acceptRules();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Bar role="note">
      <RulesIcon size={18} />
      <Text>
        <Show
          when={error()}
          fallback={
            <Trans>Accept the server rules to start writing here.</Trans>
          }
        >
          <span role="alert">{error()}</span>
        </Show>
      </Text>
      <Show when={props.server.rulesChannelId}>
        <Button
          size="sm"
          variant="text"
          onPress={() =>
            navigate(
              `/server/${props.server.id}/channel/${props.server.rulesChannelId}`,
            )
          }
        >
          <Trans>Read the rules</Trans>
        </Button>
      </Show>
      <Button size="sm" isDisabled={pending()} onPress={accept}>
        <Trans>Accept the rules</Trans>
      </Button>
    </Bar>
  );
}

const Bar = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginInline: "16px",
    marginBottom: "8px",
    padding: "8px 12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-fg-secondary)",
  },
});

const Text = styled("span", {
  base: {
    flex: 1,
    minWidth: "160px",
    fontSize: "14px",
  },
});
