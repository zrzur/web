import { For, Show, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { TranslatedError } from "@revolt/i18n/errors";
import { Button, SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/** Privileged gateway intents, as bits */
export const PRIVILEGED_INTENTS = {
  messageContent: 1 << 10,
  serverMembers: 1 << 11,
  presence: 1 << 12,
} as const;

/**
 * The bot's privileged intents with the state the server has saved. A
 * switch is saved the moment it is flipped; the row shows the saved state
 * the server answers with, never only what was clicked, and says that it
 * counts from the bot's next gateway connection (docs gap 17).
 */
export function PrivilegedIntents(props: {
  /** Read the saved switches (GET /bots/{id}) */
  load: () => Promise<number>;
  /** Save the switches; answers with what the server saved */
  save: (intents: number) => Promise<number>;
  /** Told about the saved value, for the verification form */
  onChange?: (intents: number) => void;
}) {
  const { t } = useLingui();
  const [intents, setIntents] = createSignal<number>();
  const [loadError, setLoadError] = createSignal<unknown>();
  const [saving, setSaving] = createSignal<number>();
  const [error, setError] = createSignal<unknown>();
  const [saved, setSaved] = createSignal<string>();

  async function load() {
    setLoadError(undefined);
    try {
      const value = await props.load();
      setIntents(value);
      props.onChange?.(value);
    } catch (err) {
      setLoadError(err);
    }
  }
  onMount(() => void load());

  const INTENTS = [
    {
      bit: PRIVILEGED_INTENTS.messageContent,
      icon: "chat-circle" as const,
      title: () => t`Message content`,
      text: () =>
        t`Read the text, embeds and files of messages that don't mention the bot.`,
    },
    {
      bit: PRIVILEGED_INTENTS.serverMembers,
      icon: "users" as const,
      title: () => t`Server members`,
      text: () =>
        t`See members join, leave and change, and load the member list.`,
    },
    {
      bit: PRIVILEGED_INTENTS.presence,
      icon: "circle" as const,
      title: () => t`Presence`,
      text: () => t`See who is online and their status.`,
    },
  ];

  const isOn = (bit: number) => ((intents() ?? 0) & bit) !== 0;

  async function flip(intent: (typeof INTENTS)[number]) {
    const current = intents();
    if (current === undefined || saving() !== undefined) return;
    setSaving(intent.bit);
    setError(undefined);
    setSaved(undefined);
    try {
      const value = await props.save(current ^ intent.bit);
      setIntents(value);
      props.onChange?.(value);
      setSaved(
        (value & intent.bit) !== 0
          ? t`Saved: ${intent.title()} is on. It counts from the bot's next connection.`
          : t`Saved: ${intent.title()} is off. It counts from the bot's next connection.`,
      );
    } catch (err) {
      setError(err);
    } finally {
      setSaving(undefined);
    }
  }

  return (
    <SettingsSection
      title={<Trans>Privileged intents</Trans>}
      description={
        <Trans>
          Turn these on only if your bot needs them. Without them it still works
          with commands, buttons and messages that mention it. A switch is saved
          at once and applies from the bot's next connection to the gateway:
          restart or reconnect your bot.
        </Trans>
      }
    >
      <Show
        when={!loadError()}
        fallback={
          <SettingsRow
            icon={<Icon name="warning" size={20} />}
            title={<Trans>Couldn't load the saved intents.</Trans>}
            description={<TranslatedError error={loadError()} />}
            control={() => (
              <Button size="sm" variant="tonal" onPress={() => void load()}>
                <Trans>Try again</Trans>
              </Button>
            )}
          />
        }
      >
        <For each={INTENTS}>
          {(intent) => (
            <SettingsRow
              icon={<Icon name={intent.icon} size={20} />}
              title={intent.title()}
              description={
                <>
                  {intent.text()}
                  <State data-intent-state={isOn(intent.bit) ? "on" : "off"}>
                    {intents() === undefined
                      ? t`Loading…`
                      : saving() === intent.bit
                        ? t`Saving…`
                        : isOn(intent.bit)
                          ? t`On (saved)`
                          : t`Off (saved)`}
                  </State>
                </>
              }
              onClick={() => void flip(intent)}
              control={(ids) => (
                <Toggle
                  checked={isOn(intent.bit)}
                  disabled={intents() === undefined || saving() !== undefined}
                  onChange={() => void flip(intent)}
                  aria-labelledby={ids.labelId}
                  aria-describedby={ids.descriptionId}
                />
              )}
            />
          )}
        </For>
      </Show>
      <Show when={saved()}>
        <Status role="status">{saved()}</Status>
      </Show>
      <Show when={error()}>
        <Status role="alert" data-error>
          <Trans>Not saved. The switch shows what is saved.</Trans>{" "}
          <TranslatedError error={error()} />
        </Status>
      </Show>
    </SettingsSection>
  );
}

const State = styled("span", {
  base: {
    display: "block",
    marginBlockStart: "4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    "&[data-intent-state=on]": { color: "var(--z-status-success)" },
  },
});

const Status = styled("p", {
  base: {
    margin: 0,
    padding: "12px",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
    borderInlineStart: "4px solid var(--z-status-success)",
    "&[data-error]": { borderInlineStartColor: "var(--z-danger)" },
  },
});
