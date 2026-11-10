import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { TextWithEmoji } from "@revolt/markdown";
import {
  followVoiceEvents,
  playSound,
  soundboardOf,
} from "@revolt/rtc/voiceExtrasStore";
import { Button, IconButton } from "@revolt/ui/components/design";
import { Icon } from "@revolt/ui/icons/Icon";

import { setSoundboardOpen } from "./soundboardOpen";

/**
 * The server's sounds, as buttons: press one and everyone in the call hears
 * it. Lazy: loads with the first open, and the list is fetched once per
 * server (events keep it current).
 */
export default function SoundboardPicker(props: { channel: Channel }) {
  const { t } = useLingui();
  const describeError = useError();
  const client = useClient();
  const server = () => props.channel.server;

  const board = () => {
    const current = server();
    if (!current) return;
    followVoiceEvents(client());
    return soundboardOf(client(), current);
  };
  const [loaded] = createResource(board, (entry) => entry.load());
  const sounds = () => [...(board()?.sounds.values() ?? [])];

  const [error, setError] = createSignal<string>();
  const [playing, setPlaying] = createSignal<string>();

  async function play(id: string) {
    setError(undefined);
    setPlaying(id);
    try {
      await playSound(client(), props.channel, id);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPlaying(undefined);
    }
  }

  return (
    <Panel data-soundboard aria-label={t`Soundboard`}>
      <Head>
        <Icon name="music-note" size={20} />
        <Title>
          <Trans>Soundboard</Trans>
        </Title>
        <IconButton
          size="xs"
          variant="toolbar"
          aria-label={t`Close soundboard`}
          onPress={() => setSoundboardOpen(false)}
        >
          <Icon name="x" size={18} />
        </IconButton>
      </Head>

      <Show
        when={!loaded.loading}
        fallback={
          <Muted>
            <Trans>Loading…</Trans>
          </Muted>
        }
      >
        <Show
          when={!loaded.error}
          fallback={
            <ErrorLine role="alert">{describeError(loaded.error)}</ErrorLine>
          }
        >
          <Show
            when={sounds().length}
            fallback={
              <Muted data-soundboard-empty>
                <Trans>
                  No sounds yet. People who manage the soundboard add them in
                  Server settings, Soundboard.
                </Trans>
              </Muted>
            }
          >
            <Grid>
              <For each={sounds()}>
                {(sound) => (
                  <Button
                    size="sm"
                    variant="tonal"
                    data-sound={sound._id}
                    isDisabled={!!playing()}
                    onPress={() => play(sound._id)}
                  >
                    <Show when={sound.emoji}>
                      <span aria-hidden="true">
                        <TextWithEmoji content={sound.emoji!} />
                      </span>
                    </Show>
                    <SoundName>{sound.name}</SoundName>
                  </Button>
                )}
              </For>
            </Grid>
          </Show>
        </Show>
      </Show>

      <Show when={error()}>
        <ErrorLine role="alert">{error()}</ErrorLine>
      </Show>
    </Panel>
  );
}

const Panel = styled("section", {
  base: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-icon-muted)",
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    // phones: the close button is a 44 px target
    _phone: { "& button": { minWidth: "44px", minHeight: "44px" } },
  },
});

const Title = styled("h2", {
  base: {
    flexGrow: 1,
    margin: 0,
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 600,
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    gap: "8px",
    maxHeight: "200px",
    overflowY: "auto",
    "& button": {
      justifyContent: "flex-start",
      gap: "8px",
      minWidth: 0,
      _phone: { minHeight: "44px" },
    },
  },
});

const SoundName = styled("span", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Muted = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});

const ErrorLine = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-danger)",
  },
});
