import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { TextWithEmoji } from "@revolt/markdown";
import {
  addLibrarySound,
  fetchSoundLibrary,
  followVoiceEvents,
  playSound,
  soundLibraryName,
  soundboardOf,
} from "@revolt/rtc/voiceExtrasStore";
import { IconButton } from "@revolt/ui/components/design";
import { Icon } from "@revolt/ui/icons/Icon";

import { setSoundboardOpen } from "./soundboardOpen";

/** Tiles shown before "See all": two rows of three */
export const SOUNDBOARD_FIRST = 6;

/**
 * The server's sounds as tiles in a small card over the call's controls:
 * press one and everyone in the call hears it. Two rows first, "See all"
 * for the rest. Escape or the close button shuts it. Lazy: loads with the
 * first open, and the list is fetched once per server (events keep it
 * current).
 */
export default function SoundboardPicker(props: {
  channel: Channel;
  /** "dock": floats over the call above the voice card, in its colours */
  placement?: "call" | "dock";
}) {
  const { t, i18n } = useLingui();
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
  const [all, setAll] = createSignal(false);
  const shown = () => (all() ? sounds() : sounds().slice(0, SOUNDBOARD_FIRST));

  // a server without sounds yet: whoever may add sounds sees a few from the
  // library, and pressing one adds it to the server and plays it
  const canAdd = () => !!server()?.havePermission("ManageSoundboard");
  const [library] = createResource(
    () =>
      !loaded.loading && !loaded.error && !sounds().length && canAdd()
        ? client()
        : undefined,
    (current) => fetchSoundLibrary(current),
  );
  const suggestions = () => {
    const list = library()?.sounds ?? [];
    const reactions = list.filter((sound) => sound.category === "reactions");
    return (reactions.length >= SOUNDBOARD_FIRST ? reactions : list).slice(
      0,
      SOUNDBOARD_FIRST,
    );
  };

  async function addAndPlay(libraryId: string) {
    const current = server();
    if (playing() || !current) return;
    setError(undefined);
    setPlaying(libraryId);
    try {
      // the server names it in the adder's language
      const created = await addLibrarySound(client(), current, libraryId);
      board()?.sounds.set(created._id, created);
      await playSound(client(), props.channel, created._id);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPlaying(undefined);
    }
  }

  async function play(id: string) {
    if (playing()) return;
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
    <Card
      data-soundboard
      data-placement={props.placement ?? "call"}
      aria-label={t`Soundboard`}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        setSoundboardOpen(false);
      }}
    >
      <Head>
        <Icon name="music-note" size={18} />
        <Title>
          <Trans>Soundboard</Trans>
        </Title>
        <Show when={sounds().length > SOUNDBOARD_FIRST}>
          <MoreLink
            type="button"
            data-soundboard-all
            aria-expanded={all()}
            onClick={() => setAll(!all())}
          >
            <Show when={all()} fallback={<Trans>See all</Trans>}>
              <Trans>Show less</Trans>
            </Show>
          </MoreLink>
        </Show>
        <IconButton
          size="xs"
          variant="toolbar"
          aria-label={t`Close soundboard`}
          onPress={() => setSoundboardOpen(false)}
        >
          <Icon name="x" size={16} />
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
              <Show
                when={suggestions().length}
                fallback={
                  <Muted data-soundboard-empty>
                    <Trans>
                      No sounds yet. People who manage the soundboard add them
                      in Server settings, Soundboard.
                    </Trans>
                  </Muted>
                }
              >
                <Muted>
                  <Trans>
                    No sounds here yet. Press one to add it to this server and
                    play it.
                  </Trans>
                </Muted>
                <Grid data-placement={props.placement ?? "call"}>
                  <For each={suggestions()}>
                    {(sound) => (
                      <Tile
                        type="button"
                        data-suggested-sound={sound.id}
                        data-playing={playing() === sound.id || undefined}
                        aria-disabled={!!playing() || undefined}
                        title={soundLibraryName(
                          sound.names,
                          i18n().locale || "en",
                        )}
                        onClick={() => void addAndPlay(sound.id)}
                      >
                        <TileIcon aria-hidden="true">{sound.emoji}</TileIcon>
                        <SoundName>
                          {soundLibraryName(sound.names, i18n().locale || "en")}
                        </SoundName>
                      </Tile>
                    )}
                  </For>
                </Grid>
              </Show>
            }
          >
            <Grid
              data-all={all() || undefined}
              data-placement={props.placement ?? "call"}
            >
              <For each={shown()}>
                {(sound) => (
                  <Tile
                    type="button"
                    data-sound={sound._id}
                    data-playing={playing() === sound._id || undefined}
                    aria-disabled={!!playing() || undefined}
                    title={sound.name}
                    onClick={() => void play(sound._id)}
                  >
                    <TileIcon aria-hidden="true">
                      <Show
                        when={sound.emoji}
                        fallback={<Icon name="music-note" size={16} />}
                      >
                        <TextWithEmoji content={sound.emoji!} />
                      </Show>
                    </TileIcon>
                    <SoundName>{sound.name}</SoundName>
                  </Tile>
                )}
              </For>
            </Grid>
          </Show>
        </Show>
      </Show>

      <Show when={error()}>
        <ErrorLine role="alert">{error()}</ErrorLine>
      </Show>
    </Card>
  );
}

const Card = styled("section", {
  base: {
    flexShrink: 0,
    alignSelf: "center",
    width: "min(440px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    borderRadius: "var(--z-radius-md, 14px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised, var(--z-bg-nav))",
    boxShadow: "0 12px 32px rgb(0 0 0 / 0.32)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-icon-muted)",
    // over the call, above the voice card: the same chrome as that card and
    // the message composer, so the two read as one piece
    "&[data-placement='dock']": {
      width: "100%",
      borderRadius: "var(--z-dock-radius, 12px)",
      background: "var(--z-dock-bg)",
      border: "1px solid var(--z-dock-border)",
      boxShadow: "var(--z-dock-lift)",
      "--z-sound-tile":
        "color-mix(in srgb, var(--z-fg-primary) 7%, transparent)",
      // the tiles act like the card's own buttons below (Camera, Screen):
      // a lighter grey on hover, the accent fill while a sound plays
      "& [data-sound], & [data-suggested-sound]": {
        borderColor: "transparent",
        _hover: {
          background:
            "color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
          borderColor: "transparent",
        },
        "&[data-playing]": {
          color: "var(--z-on-accent)",
          background: "var(--z-accent-fill, var(--z-accent))",
          borderColor: "transparent",
        },
      },
    },
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingInline: "4px",
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
    fontWeight: 650,
  },
});

const MoreLink = styled("button", {
  base: {
    border: "none",
    background: "none",
    padding: "4px 6px",
    borderRadius: "var(--z-radius-sm, 6px)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-link, var(--z-accent))",
    cursor: "pointer",
    _hover: { textDecoration: "underline" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    "&[data-all]": { maxHeight: "232px", overflowY: "auto" },
    // as wide as the voice card: two tiles a row, so names keep their room
    "&[data-placement='dock']": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    _phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
});

const Tile = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minWidth: 0,
    height: "44px",
    paddingInline: "10px",
    border: "1px solid transparent",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-sound-tile, var(--z-bg-nav, var(--z-bg-sidebar)))",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.12s ease, border-color 0.12s ease",
    _hover: {
      background: "color-mix(in srgb, var(--z-accent) 14%, var(--z-bg-nav))",
      borderColor: "color-mix(in srgb, var(--z-accent) 35%, transparent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "&[data-playing]": {
      borderColor: "var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 20%, var(--z-bg-nav))",
    },
    "&[aria-disabled]:not([data-playing])": { opacity: 0.6, cursor: "wait" },
  },
});

const TileIcon = styled("span", {
  base: {
    display: "inline-flex",
    flexShrink: 0,
    fontSize: "18px",
    lineHeight: 1,
    "& img": { width: "20px", height: "20px" },
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
    paddingInline: "4px",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});

const ErrorLine = styled("p", {
  base: {
    margin: 0,
    paddingInline: "4px",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-danger)",
  },
});
