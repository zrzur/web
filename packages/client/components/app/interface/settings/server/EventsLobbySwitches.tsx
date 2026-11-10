import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server, ServerLobby } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Column, SettingsRow, SettingsSection, Text, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSaved } from "./savedNotice";

/**
 * Events and the lobby on or off for this server. Both are off in every new
 * server; turning one on saves at once and its row appears at the top of
 * everyone's channel list. The events switch is there only when this Zrzur
 * node has events.
 */
export function EventsLobbySwitches(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();

  const saved = useSaved();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<unknown>();

  const canManage = () => props.server.havePermission("ManageServer");
  const platformEvents = () =>
    client()?.configuration?.features?.server_events === true;
  const lobbyOn = () => props.server.lobby?.enabled === true;

  async function run(change: () => Promise<void>) {
    if (!canManage() || pending()) return;
    setPending(true);
    setError(undefined);
    try {
      await change();
      saved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  const setEvents = (on: boolean) =>
    run(() => props.server.setEventsEnabled(on));

  // the lobby is stored whole: keep everything else as it is
  const setLobby = (on: boolean) =>
    run(() =>
      props.server.edit({
        lobby: {
          ...(JSON.parse(JSON.stringify(props.server.lobby ?? {})) as object),
          enabled: on,
        } as ServerLobby,
      }),
    );

  const row = (
    icon: "calendar" | "house",
    title: string,
    description: string,
    on: () => boolean,
    set: (on: boolean) => Promise<void>,
  ) => (
    <SettingsRow
      icon={<Icon name={icon} size={20} />}
      title={title}
      description={description}
      disabled={!canManage() || pending()}
      onClick={() => void set(!on())}
      control={(ids) => (
        <Toggle
          checked={on()}
          disabled={!canManage() || pending()}
          onChange={() => void set(!on())}
          aria-labelledby={ids.labelId}
          aria-describedby={ids.descriptionId}
        />
      )}
    />
  );

  return (
    <Column gap="lg">
      <SettingsSection>
        <Show when={platformEvents()}>
          {row(
            "calendar",
            t({ message: "Events", context: "scheduled events" }),
            t`Plan game nights and meetups; an Events row shows for everyone.`,
            () => props.server.eventsEnabled,
            setEvents,
          )}
        </Show>
        {row(
          "house",
          t`Lobby`,
          t`A welcome page; a Lobby row shows for everyone and the server opens on it.`,
          lobbyOn,
          setLobby,
        )}
      </SettingsSection>
      <Text class="label" size="small">
        <Trans>
          Turning one off hides its row and keeps what you made: planned
          events and the lobby design stay saved.
        </Trans>
      </Text>
      <Show when={error()}>
        <div role="alert">
          <TranslatedError error={error()} />
        </div>
      </Show>
    </Column>
  );
}
