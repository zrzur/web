import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useNotifications } from "@revolt/client";
import { useState } from "@revolt/state";
import { Column, SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import Sounds from "./Sounds";

/**
 * Notifications page — flat desktop rows with switches
 */
export default function Notifications(props: { isDesktop: boolean }) {
  const { settings } = useState();

  const { toggleNotificationPermission, togglePushPermission } =
    useNotifications();

  return (
    <Column gap="xl">
      <Show when={settings.desktopNotificationsState !== "unsupported"}>
        <SettingsSection title={<Trans>Alerts</Trans>}>
          <SettingsRow
            icon={<Icon name="bell" size={20} />}
            title={<Trans>Desktop notifications</Trans>}
            description={
              <Show
                when={props.isDesktop}
                fallback={
                  <Trans>Show notifications while this tab is open.</Trans>
                }
              >
                <Trans>
                  Show notifications while the app is open or in the background.
                </Trans>
              </Show>
            }
            onClick={() => toggleNotificationPermission(true)}
            control={(ids) => (
              <Toggle
                checked={settings.desktopNotificationsState === "allowed"}
                onChange={() => toggleNotificationPermission(true)}
                aria-labelledby={ids.labelId}
                aria-describedby={ids.descriptionId}
              />
            )}
          />

          <Show when={!props.isDesktop}>
            <SettingsRow
              icon={<Icon name="device-mobile" size={20} />}
              title={<Trans>Push notifications</Trans>}
              description={
                <Trans>
                  Ask the browser to deliver notifications while Zrzur is
                  closed. Delivery depends on the server's push service.
                </Trans>
              }
              onClick={() => togglePushPermission(true)}
              control={(ids) => (
                <Toggle
                  checked={settings.pushNotificationsState === "allowed"}
                  onChange={() => togglePushPermission(true)}
                  aria-labelledby={ids.labelId}
                  aria-describedby={ids.descriptionId}
                />
              )}
            />
          </Show>
        </SettingsSection>
      </Show>

      <Sounds />
    </Column>
  );
}
