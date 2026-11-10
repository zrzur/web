import { For, Show, createResource, createSignal, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import {
  createSound,
  deleteSound,
  fetchSoundboard,
} from "@zrzur/sdk/solid/voiceExtras";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import type { SoundboardPlayer } from "@revolt/rtc/soundboardPlayer";
import {
  Button,
  Column,
  IconButton,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type SoundProblem,
  SOUND_DEFAULT_BYTES,
  SOUND_MAX_MS,
  checkSound,
  nameFromFile,
} from "./soundFile";

/**
 * Soundboard settings: add a short sound, listen to it, remove it
 */
export function SoundboardList(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const describeError = useError();

  const [loaded] = createResource(
    () => props.server,
    (server) => fetchSoundboard(client(), server),
  );
  const sounds = () => [...props.server.soundboard.values()];
  const limit = () => props.server.soundboardLimit();
  const isFull = () => !!limit() && sounds().length >= limit();
  const maxBytes = () =>
    instance.limits().file_upload_size_limits["sounds"] ?? SOUND_DEFAULT_BYTES;

  const [file, setFile] = createSignal<File>();
  const [durationMs, setDurationMs] = createSignal<number>();
  const [name, setName] = createSignal("");
  const [emoji, setEmoji] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  let input: HTMLInputElement | undefined;

  const problemText = (problem: SoundProblem) => {
    switch (problem) {
      case "type":
        return t`Pick an MP3, OGG or WAV file.`;
      case "size":
        return t`This file is too big. Sounds can be up to ${Math.round(maxBytes() / 1000)} KB.`;
      case "length":
        return t`This sound is too long. Sounds can be up to ${SOUND_MAX_MS / 1000} seconds.`;
      default:
        return t`This file can't be played as a sound.`;
    }
  };

  async function pick(picked?: File) {
    setError(undefined);
    setFile(undefined);
    setDurationMs(undefined);
    if (!picked) return;
    const checked = await checkSound(picked, maxBytes());
    if ("problem" in checked) {
      setError(problemText(checked.problem));
      return;
    }
    setFile(picked);
    setDurationMs(checked.durationMs);
    if (!name()) setName(nameFromFile(picked.name));
  }

  const canAdd = () =>
    !!file() &&
    !!durationMs() &&
    name().trim().length > 0 &&
    !busy() &&
    !isFull();

  async function add() {
    if (!canAdd()) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = await client().uploadFile(
        "sounds",
        file()!,
        instance.mediaUrl,
      );
      await createSound(client(), props.server, id, {
        name: name().trim(),
        duration_ms: durationMs()!,
        ...(emoji().trim() ? { emoji: emoji().trim() } : {}),
      });
      setFile(undefined);
      setDurationMs(undefined);
      setName("");
      setEmoji("");
      if (input) input.value = "";
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  // listening here plays on this device only, from the same cache as calls
  let player: Promise<SoundboardPlayer> | undefined;
  async function listen(id: string, volume: number) {
    const module = await import("@revolt/rtc/soundboardPlayer");
    player ??= Promise.resolve(new module.SoundboardPlayer());
    const soundboard = await player;
    await soundboard
      .play(
        id,
        module.soundUrl(instance.mediaUrl, id),
        module.soundGain(volume, 1),
      )
      .catch((err) => setError(describeError(err)));
  }
  onCleanup(() => void player?.then((soundboard) => soundboard.stopAll()));

  // removing asks once more, in the row itself
  const [confirming, setConfirming] = createSignal<string>();
  async function remove(id: string) {
    setConfirming(undefined);
    setError(undefined);
    try {
      await deleteSound(client(), props.server, id);
    } catch (err) {
      setError(describeError(err));
    }
  }

  const seconds = (ms: number) => (ms / 1000).toFixed(1);

  return (
    <Column gap="xl">
      <SettingsSection
        title={<Trans>Add a sound</Trans>}
        description={
          <Show
            when={limit()}
            fallback={<Trans>Short sounds members play in voice calls.</Trans>}
          >
            <Trans>
              {Math.max(0, limit() - sounds().length)} of {limit()} sounds left.
              Up to {SOUND_MAX_MS / 1000} seconds each.
            </Trans>
          </Show>
        }
      >
        <form
          style={{ display: "contents" }}
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Upload>
            <input
              ref={input}
              type="file"
              hidden
              accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav"
              data-sound-file
              onChange={(event) => void pick(event.currentTarget.files?.[0])}
            />
            <Button
              size="md"
              variant="tonal"
              isDisabled={isFull() || busy()}
              onPress={() => input?.click()}
            >
              <Icon name="upload-simple" size={18} />
              <Show when={file()} fallback={<Trans>Choose a sound</Trans>}>
                <Picked>{file()!.name}</Picked>
              </Show>
            </Button>
            <Field>
              <TextField
                label={t`Name`}
                name="sound-name"
                value={name()}
                maxlength={32}
                counter
                onInput={(event) => setName(event.currentTarget.value)}
              />
            </Field>
            <EmojiField>
              <TextField
                label={t`Emoji (optional)`}
                name="sound-emoji"
                value={emoji()}
                maxlength={8}
                onInput={(event) => setEmoji(event.currentTarget.value)}
              />
            </EmojiField>
            <Button type="submit" size="md" isDisabled={!canAdd()}>
              <Show when={busy()} fallback={<Trans>Add sound</Trans>}>
                <Trans>Uploading…</Trans>
              </Show>
            </Button>
            <Hint role={error() ? "alert" : undefined} data-error={!!error()}>
              <Show
                when={error()}
                fallback={
                  <Show
                    when={isFull()}
                    fallback={
                      <Trans>
                        An MP3, OGG or WAV file of up to{" "}
                        {Math.round(maxBytes() / 1000)} KB, then a name.
                      </Trans>
                    }
                  >
                    <Trans>
                      The soundboard is full. Remove a sound, or add Wings to
                      the server for more.
                    </Trans>
                  </Show>
                }
              >
                {error()}
              </Show>
            </Hint>
          </Upload>
        </form>
      </SettingsSection>

      <SettingsSection title={<Trans>Sounds</Trans>}>
        <Show
          when={!loaded.loading}
          fallback={
            <Empty>
              <Trans>Loading…</Trans>
            </Empty>
          }
        >
          <Show
            when={sounds().length}
            fallback={
              <Empty data-soundboard-empty>
                <Trans>No sounds yet.</Trans>
              </Empty>
            }
          >
            <For each={sounds()}>
              {(sound) => (
                <SettingsRow
                  icon={
                    <Glyph aria-hidden="true">
                      {sound.emoji || <Icon name="music-note" size={20} />}
                    </Glyph>
                  }
                  title={<span data-sound-row={sound._id}>{sound.name}</span>}
                  description={t`${seconds(sound.duration_ms)} s`}
                  control={() => (
                    <Show
                      when={confirming() === sound._id}
                      fallback={
                        <Row>
                          <IconButton
                            size="sm"
                            variant="tonal"
                            aria-label={t`Listen to ${sound.name}`}
                            onPress={() => listen(sound._id, sound.volume)}
                          >
                            <Icon name="speaker-high" size={18} />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="tonal"
                            aria-label={t`Remove ${sound.name}`}
                            data-remove-sound={sound._id}
                            onPress={() => setConfirming(sound._id)}
                          >
                            <Icon name="trash" size={18} />
                          </IconButton>
                        </Row>
                      }
                    >
                      <Row>
                        <Button
                          size="sm"
                          variant="_error"
                          data-confirm-remove={sound._id}
                          onPress={() => remove(sound._id)}
                        >
                          <Trans>Remove</Trans>
                        </Button>
                        <Button
                          size="sm"
                          variant="text"
                          onPress={() => setConfirming(undefined)}
                        >
                          <Trans>Cancel</Trans>
                        </Button>
                      </Row>
                    </Show>
                  )}
                />
              )}
            </For>
          </Show>
        </Show>
      </SettingsSection>
    </Column>
  );
}

/**
 * [Choose a sound] [Name ........] [Emoji] [Add sound]
 * hint or error
 * Phones: one column.
 */
const Upload = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) 120px auto",
    alignItems: "end",
    columnGap: "16px",
    rowGap: "12px",
    padding: "16px 20px",
    "& > button": { gap: "8px" },
    _phone: {
      gridTemplateColumns: "minmax(0, 1fr)",
      padding: "16px",
      "& > button": { width: "100%", minHeight: "44px" },
    },
  },
});

const Field = styled("div", { base: { minWidth: 0 } });
const EmojiField = styled("div", { base: { minWidth: 0 } });

const Picked = styled("span", {
  base: {
    maxWidth: "160px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Hint = styled("p", {
  base: {
    gridColumn: "1 / -1",
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
    "&[data-error='true']": { color: "var(--z-danger)" },
  },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    padding: "16px 20px",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
  },
});

const Glyph = styled("span", {
  base: {
    display: "inline-grid",
    placeItems: "center",
    width: "20px",
    fontSize: "18px",
    lineHeight: 1,
  },
});

const Row = styled("div", {
  base: { display: "flex", gap: "8px" },
});
