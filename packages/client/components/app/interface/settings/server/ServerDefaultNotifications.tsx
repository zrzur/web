import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server, ServerNotificationLevel } from "@zrzur/sdk/solid";

import { useError } from "@revolt/i18n";
import { Column, SettingsChoices, Text } from "@revolt/ui";

import { useSaved } from "./savedNotice";

/**
 * What members are notified about until they choose for themselves
 * (default_notifications_tests.rs); missing means mentions only.
 */
export function ServerDefaultNotifications(props: { server: Server }) {
  const { t } = useLingui();
  const describeError = useError();

  const saved = useSaved();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const canManage = () => props.server.havePermission("ManageServer");
  const current = (): ServerNotificationLevel =>
    props.server.defaultNotifications ?? "Mentions";

  async function choose(level: ServerNotificationLevel) {
    if (!canManage() || pending() || level === current()) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.setDefaultNotifications(level);
      saved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Column gap="lg">
      <SettingsChoices<ServerNotificationLevel>
        label={<Trans>Notify members about</Trans>}
        value={current()}
        disabled={!canManage() || pending()}
        onChange={choose}
        options={[
          {
            value: "All",
            title: t`All messages`,
            description: t`Members are notified about every message.`,
          },
          {
            value: "Mentions",
            title: t`Mentions only`,
            description: t`Members are notified only when someone mentions them.`,
          },
        ]}
      />
      <Text class="label" size="small">
        <Trans>Each member can still choose their own setting.</Trans>
      </Text>
      <Show when={error()}>
        <span role="alert">
          <Text size="small">{error()}</Text>
        </span>
      </Show>
    </Column>
  );
}
