import { createFormControl, createFormGroup } from "solid-forms";
import { For, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server, ServerStat } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { billingAvailable } from "@revolt/client/billing";
import { useError } from "@revolt/i18n";
import {
  Column,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { RulesIcon } from "@revolt/ui/icons/RulesIcon";

import { channelLabel } from "./channelLabel";
import {
  type SystemMessageKey,
  SYSTEM_MESSAGE_KEYS,
  systemMessagesPatch,
} from "./systemMessages";
import { SaveSlot } from "../pageSave";

/**
 * Special channels and channel-list counters: which channel holds the rules,
 * where join / leave / kick / ban messages are posted, and what the channel
 * list shows on top.
 */
export function ChannelExtras(props: { server: Server }) {
  const { t } = useLingui();
  const describeError = useError();

  const current = (key: SystemMessageKey) =>
    props.server.systemMessages?.[key] ?? "none";

  /* eslint-disable solid/reactivity */
  const form = createFormGroup({
    rules: createFormControl(props.server.rulesChannelId ?? "none"),
    stats: createFormControl<ServerStat[]>([...props.server.stats]),
    user_joined: createFormControl(current("user_joined")),
    user_left: createFormControl(current("user_left")),
    user_kicked: createFormControl(current("user_kicked")),
    user_banned: createFormControl(current("user_banned")),
  });
  /* eslint-enable solid/reactivity */

  // rules live in a channel people can read
  const textChannels = () =>
    props.server.channels.filter((channel) => !channel.isVoice);

  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const STATS: [
    ServerStat,
    Parameters<typeof Icon>[0]["name"],
    () => string,
  ][] = [
    ["Members", "users", () => t`Members`],
    ["Channels", "hash", () => t`Channels`],
    ["Roles", "shield", () => t`Roles`],
    ["Wings", "lightning", () => t`Wings`],
  ];

  const MESSAGES: Record<
    SystemMessageKey,
    [Parameters<typeof Icon>[0]["name"], () => string]
  > = {
    user_joined: ["user-plus", () => t`Member joined`],
    user_left: ["user-minus", () => t`Member left`],
    user_kicked: ["sign-out", () => t`Member kicked`],
    user_banned: ["prohibit", () => t`Member banned`],
  };

  const toggleStat = (stat: ServerStat) => {
    const value = form.controls.stats.value;
    form.controls.stats.setValue(
      value.includes(stat) ? value.filter((s) => s !== stat) : [...value, stat],
    );
    form.controls.stats.markDirty(true);
  };

  async function save() {
    if (saving() || !form.isDirty) return;
    setError(undefined);
    setSaving(true);
    try {
      const changes: Parameters<Server["edit"]>[0] = { remove: [] };
      if (form.controls.rules.isDirty) {
        const rules = form.controls.rules.value;
        if (rules === "none") changes.remove!.push("RulesChannel");
        else changes.rules_channel = rules;
      }
      if (form.controls.stats.isDirty) {
        const stats = form.controls.stats.value;
        if (stats.length) changes.stats = stats;
        else changes.remove!.push("Stats");
      }
      if (SYSTEM_MESSAGE_KEYS.some((key) => form.controls[key].isDirty)) {
        changes.system_messages = systemMessagesPatch(
          props.server.systemMessages,
          {
            user_joined: form.controls.user_joined.value,
            user_left: form.controls.user_left.value,
            user_kicked: form.controls.user_kicked.value,
            user_banned: form.controls.user_banned.value,
          },
        );
      }
      await props.server.edit(changes);
      for (const control of Object.values(form.controls))
        control.markDirty(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    form.controls.rules.setValue(props.server.rulesChannelId ?? "none");
    form.controls.stats.setValue([...props.server.stats]);
    for (const key of SYSTEM_MESSAGE_KEYS)
      form.controls[key].setValue(current(key));
    for (const control of Object.values(form.controls))
      control.markDirty(false);
    setError(undefined);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Column gap="xl">
        <SettingsSection
          title={<Trans>Special channels</Trans>}
          description={
            <Trans>
              Where your rules live, and where an automatic message is posted
              when members join, leave or are removed.
            </Trans>
          }
        >
          <SettingsRow
            icon={<RulesIcon size={20} />}
            title={<Trans>Rules channel</Trans>}
            description={
              <Trans>
                Pinned at the top of the channel list, with a "Read the rules"
                button in the Lobby.
              </Trans>
            }
            control={(ids) => (
              <SelectWidth>
                <FloatingSelect
                  aria-labelledby={ids.labelId}
                  value={form.controls.rules.value}
                  onChange={(e) => {
                    form.controls.rules.setValue(
                      e.currentTarget.value || "none",
                    );
                    form.controls.rules.markDirty(true);
                  }}
                >
                  <MenuItem value="none">
                    <Trans>None</Trans>
                  </MenuItem>
                  <For each={textChannels()}>
                    {(channel) => (
                      <MenuItem value={channel.id}>
                        {channelLabel(channel.name)}
                      </MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </SelectWidth>
            )}
          />
          <For each={SYSTEM_MESSAGE_KEYS}>
            {(key) => (
              <SettingsRow
                icon={<Icon name={MESSAGES[key][0]} size={20} />}
                title={MESSAGES[key][1]()}
                control={(ids) => (
                  <SelectWidth>
                    <FloatingSelect
                      aria-labelledby={ids.labelId}
                      value={form.controls[key].value}
                      onChange={(e) => {
                        form.controls[key].setValue(
                          e.currentTarget.value || "none",
                        );
                        form.controls[key].markDirty(true);
                      }}
                    >
                      <MenuItem value="none">
                        <Trans>Off</Trans>
                      </MenuItem>
                      <For each={textChannels()}>
                        {(channel) => (
                          <MenuItem value={channel.id}>
                            {channelLabel(channel.name)}
                          </MenuItem>
                        )}
                      </For>
                    </FloatingSelect>
                  </SelectWidth>
                )}
              />
            )}
          </For>
        </SettingsSection>

        <SettingsSection
          title={<Trans>Counters</Trans>}
          description={
            <Trans>
              Live counters at the top of the channel list. They update by
              themselves and nobody can open them.
            </Trans>
          }
        >
          <For each={STATS.filter(([stat]) => stat !== "Wings" || billingAvailable())}>
            {([stat, icon, label]) => (
              <SettingsRow
                icon={<Icon name={icon} size={20} />}
                title={label()}
                onClick={() => toggleStat(stat)}
                control={(ids) => (
                  <Toggle
                    checked={form.controls.stats.value.includes(stat)}
                    onChange={() => toggleStat(stat)}
                    aria-labelledby={ids.labelId}
                  />
                )}
              />
            )}
          </For>
        </SettingsSection>

        <SaveSlot
          show={form.isDirty}
          saving={saving()}
          error={error()}
          onReset={reset}
        />
      </Column>
    </form>
  );
}

const SelectWidth = styled("div", {
  base: { width: "min(240px, 40vw)" },
});
