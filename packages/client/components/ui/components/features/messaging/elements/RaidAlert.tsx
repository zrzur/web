import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { RaidAlertSystemMessage } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useSmartParams } from "@revolt/routing";
import { Button } from "@revolt/ui/components/design";

/**
 * Many people joined in a short time. People who can manage the server
 * may pause invites for an hour from here, or ignore it.
 */
export function RaidAlert(props: { message: RaidAlertSystemMessage }) {
  const { t } = useLingui();
  const client = useClient();
  const params = useSmartParams();
  const describeError = useError();

  const [state, setState] = createSignal<
    "open" | "pending" | "paused" | "ignored"
  >("open");
  const [error, setError] = createSignal<string>();

  const server = () =>
    params().serverId ? client().servers.get(params().serverId!) : undefined;
  const canAct = () => !!server()?.havePermission("ManageServer");

  async function pause() {
    setState("pending");
    setError(undefined);
    try {
      await server()!.pauseSafety({ invitesHours: 1 });
      setState("paused");
    } catch (err) {
      setError(describeError(err));
      setState("open");
    }
  }

  return (
    <Alert role="status">
      <span>
        {t`${props.message.joins} people joined within ${props.message.minutes} min. This can be a raid.`}
      </span>
      <Show when={canAct() && state() !== "ignored"}>
        <Show
          when={state() !== "paused"}
          fallback={<Trans>Invites are paused for 1 hour.</Trans>}
        >
          <Actions>
            <Button
              size="sm"
              variant="text"
              isDisabled={state() === "pending"}
              onPress={() => setState("ignored")}
            >
              <Trans>Ignore</Trans>
            </Button>
            <Button
              size="sm"
              isDisabled={state() === "pending"}
              onPress={pause}
            >
              <Trans>Pause invites</Trans>
            </Button>
          </Actions>
        </Show>
      </Show>
      <Show when={error()}>
        <span role="alert">{error()}</span>
      </Show>
    </Alert>
  );
}

const Alert = styled("span", {
  base: {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    color: "var(--z-warning, var(--md-sys-color-on-surface))",
  },
});

const Actions = styled("span", {
  base: {
    display: "inline-flex",
    gap: "8px",
  },
});
