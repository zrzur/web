import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server, ServerVerificationLevel } from "@zrzur/sdk/solid";

import { useError } from "@revolt/i18n";
import { Column, SettingsChoices, Text } from "@revolt/ui";

import { useSaved } from "./savedNotice";

/**
 * What new members need before they can talk. Enforced by the server
 * (verification_level_tests.rs); members with any role are exempt.
 */
export function ServerVerification(props: { server: Server }) {
  const { t } = useLingui();
  const describeError = useError();

  const saved = useSaved();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const canManage = () => props.server.havePermission("ManageServer");

  async function choose(level: ServerVerificationLevel) {
    if (!canManage() || pending() || level === props.server.verificationLevel)
      return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.setVerificationLevel(level);
      saved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Column gap="lg">
      <SettingsChoices<ServerVerificationLevel>
        label={<Trans>Level</Trans>}
        value={props.server.verificationLevel}
        disabled={!canManage() || pending()}
        onChange={choose}
        options={[
          {
            value: "None",
            title: t`None`,
            description: t`New members can talk right away.`,
          },
          {
            value: "Low",
            title: t`Low`,
            description: t`A verified email address.`,
          },
          {
            value: "Medium",
            title: t`Medium`,
            description: t`A verified email, and an account older than 5 minutes.`,
          },
          {
            value: "High",
            title: t`High`,
            description: t`All of the above, and 10 minutes in this server.`,
          },
        ]}
      />
      <Text class="label" size="small">
        <Trans>Members with any role, bots and the owner are exempt.</Trans>
      </Text>
      <Show when={error()}>
        <span role="alert">
          <Text size="small">{error()}</Text>
        </span>
      </Show>
    </Column>
  );
}
