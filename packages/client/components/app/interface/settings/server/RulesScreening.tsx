import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";

import { useError } from "@revolt/i18n";
import { Button, SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";
import { useSaved } from "./savedNotice";

/**
 * New members accept the rules before they can write (part of welcoming
 * them, so it sits with the lobby). Enforced by the server
 * (rules_screening_tests.rs); needs a rules channel, chosen in Notices.
 */
export function RulesScreening(props: { server: Server }) {
  const describeError = useError();
  const { navigate } = useSettingsNavigation();

  const saved = useSaved();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const canManage = () => props.server.havePermission("ManageServer");
  const enabled = () => !!props.server.rulesScreeningSince;

  async function toggle() {
    if (!canManage() || pending() || !props.server.rulesChannelId) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.setRulesScreening(!enabled());
      saved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsSection title={<Trans>Rules</Trans>}>
      <SettingsRow
        icon={<Icon name="check-square" size={20} />}
        title={<Trans>New members accept the rules</Trans>}
        description={
          <Show
            when={props.server.rulesChannelId}
            fallback={<Trans>Needs a rules channel first.</Trans>}
          >
            <Show
              when={enabled()}
              fallback={<Trans>New members can write right away.</Trans>}
            >
              <Trans>New members accept the rules before they write.</Trans>
            </Show>
          </Show>
        }
        onClick={
          canManage() && !pending() && props.server.rulesChannelId
            ? toggle
            : undefined
        }
        control={(ids) => (
          <Show
            when={props.server.rulesChannelId}
            fallback={
              <Button
                size="sm"
                variant="tonal"
                onPress={() => navigate("overview#features")}
              >
                <Trans>Choose a rules channel</Trans>
              </Button>
            }
          >
            <Toggle
              checked={enabled()}
              disabled={!canManage() || pending()}
              aria-labelledby={ids.labelId}
              onChange={toggle}
            />
          </Show>
        )}
      />
      <Show when={error()}>
        <SettingsRow
          icon={<Icon name="warning-circle" size={20} />}
          title={<span role="alert">{error()}</span>}
        />
      </Show>
    </SettingsSection>
  );
}
