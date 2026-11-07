import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { type SoundKey, useSound } from "@revolt/client";
import { useState } from "@revolt/state";
import {
  Column,
  IconButton,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon, IconName } from "@revolt/ui/icons/Icon";

type Entry = { key: SoundKey; icon: IconName; label: () => string };

/**
 * Sound preferences: one panel per group,
 * [event icon] [label] ... [preview] [enable switch]
 *
 * Only events the client actually triggers are listed (ringtones, stream
 * viewer and "user moved" sounds are registered but never played yet).
 */
export default function Sounds() {
  const { settings, sounds } = useState();
  const soundController = useSound();
  const { t } = useLingui();

  const [playing, setPlaying] = createSignal<SoundKey>();
  const [failed, setFailed] = createSignal<{
    key: SoundKey;
    blocked: boolean;
  }>();

  async function preview(key: SoundKey) {
    setFailed(undefined);
    setPlaying(key);
    const result = await soundController.preview(key);
    if (!result.ok) {
      setPlaying(undefined);
      setFailed({ key, blocked: result.reason === "blocked" });
      return;
    }

    const node = soundController.previewNode;
    const done = () => {
      if (soundController.previewNode === node && playing() === key)
        setPlaying(undefined);
    };
    node?.addEventListener("ended", done, { once: true });
    node?.addEventListener("pause", done, { once: true });
  }

  const MESSAGE_SOUNDS: Entry[] = [
    {
      key: "message",
      icon: "chat-circle-dots",
      label: () => t`Message received`,
    },
  ];

  const VOICE_SOUNDS: Entry[] = [
    { key: "mute", icon: "microphone-slash", label: () => t`Mute` },
    { key: "unmute", icon: "microphone", label: () => t`Unmute` },
    { key: "deafen", icon: "headphones-slash", label: () => t`Deafen` },
    { key: "undeafen", icon: "headphones", label: () => t`Undeafen` },
    {
      key: "userJoinVoice",
      icon: "user-plus",
      label: () => t`User joined call`,
    },
    {
      key: "userLeaveVoice",
      icon: "user-minus",
      label: () => t`User left call`,
    },
  ];

  const STREAM_SOUNDS: Entry[] = [
    {
      key: "streamStart",
      icon: "monitor-arrow-up",
      label: () => t`Stream started`,
    },
    { key: "streamEnd", icon: "monitor", label: () => t`Stream ended` },
  ];

  const row = (entry: Entry) => {
    const isPlaying = () => playing() === entry.key;
    const previewLabel = () => t`Preview: ${entry.label()}`;
    const failure = () =>
      failed()?.key === entry.key
        ? failed()!.blocked
          ? t`Your browser blocked playback. Click the page once, then try again.`
          : t`This sound couldn't be played. Check your output device.`
        : undefined;

    return (
      <SettingsRow
        icon={<Icon name={entry.icon} size={20} />}
        title={entry.label()}
        description={
          <Show when={failure()}>
            <span style={{ color: "var(--z-danger)" }}>{failure()}</span>
          </Show>
        }
        secondary={
          <IconButton
            variant="toolbar"
            size="xs"
            aria-label={previewLabel()}
            aria-pressed={isPlaying()}
            data-sound-preview={entry.key}
            data-playing={isPlaying()}
            use:floating={{
              tooltip: { placement: "top", content: previewLabel() },
            }}
            onPress={() => preview(entry.key)}
          >
            <Icon name={isPlaying() ? "speaker-high" : "play"} size={16} />
          </IconButton>
        }
        onClick={() => sounds.toggle(entry.key)}
        control={(ids) => (
          <Toggle
            checked={sounds.enabled(entry.key)}
            onChange={() => sounds.toggle(entry.key)}
            aria-labelledby={ids.labelId}
          />
        )}
      />
    );
  };

  return (
    <Show when={settings.desktopNotificationsState !== "unsupported"}>
      <Column gap="xl">
        <SettingsSection
          title={<Trans>Message sounds</Trans>}
          description={
            <Trans>
              Previews play even when a sound is switched off. Sounds use the
              speaker selected in Voice & Video.
            </Trans>
          }
        >
          <For each={MESSAGE_SOUNDS}>{row}</For>
        </SettingsSection>
        <SettingsSection title={<Trans>Voice and call sounds</Trans>}>
          <For each={VOICE_SOUNDS}>{row}</For>
        </SettingsSection>
        <SettingsSection title={<Trans>Stream sounds</Trans>}>
          <For each={STREAM_SOUNDS}>{row}</For>
        </SettingsSection>
      </Column>
    </Show>
  );
}
