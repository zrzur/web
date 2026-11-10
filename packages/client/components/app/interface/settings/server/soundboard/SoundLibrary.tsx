import {
  For,
  Show,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import {
  type SoundLibrarySound,
  type SoundboardEntry,
  SoundboardPlayer,
  addLibrarySound,
  fetchSoundLibrary,
  searchSoundLibrary,
  soundGain,
  soundLibraryName,
  soundLibraryPreviewUrl,
  soundboardChoices,
} from "@revolt/rtc/voiceExtrasStore";
import {
  Button,
  FloatingSelect,
  IconButton,
  MenuItem,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/** Rows shown at first, and added by "Show more" */
const PAGE = 24;

/**
 * The sound library: ready-made sounds a server can add. Loaded only when
 * its tab opens; a sound's file is fetched only when it is played.
 */
export default function SoundLibrary(props: {
  server: Server;
  board: SoundboardEntry;
  /** Whether this person may add sounds (Manage Soundboard) */
  canAdd: boolean;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const describeError = useError();
  const locale = () => i18n().locale || "en";

  const [library] = createResource(() => fetchSoundLibrary(client()));
  const [category, setCategory] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [shown, setShown] = createSignal(PAGE);
  const [error, setError] = createSignal<string>();

  const found = createMemo(() => {
    const list = library();
    if (!list) return [];
    return searchSoundLibrary(list, {
      category: category() || undefined,
      query: query(),
      locale: locale(),
    });
  });
  const visible = createMemo(() => found().slice(0, shown()));

  // library sounds this server has already
  const added = createMemo(
    () =>
      new Set(
        [...props.board.sounds.values()]
          .map((sound) => sound.library_id)
          .filter(Boolean),
      ),
  );
  const isFull = () =>
    !!props.board.limit() && props.board.sounds.size >= props.board.limit();

  const name = (sound: SoundLibrarySound) =>
    soundLibraryName(sound.names, locale());

  // a sound's length, in the digits and separator of the page language
  const seconds = (ms: number) =>
    new Intl.NumberFormat(locale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(ms / 1000);

  // one preview at a time, at the listener's soundboard volume
  let player: SoundboardPlayer | undefined;
  const [playing, setPlaying] = createSignal<string>();
  async function preview(sound: SoundLibrarySound) {
    player ??= new SoundboardPlayer();
    player.stopAll();
    setPlaying(sound.id);
    try {
      await player.play(
        `library:${sound.id}`,
        soundLibraryPreviewUrl(client(), sound),
        soundGain(100, soundboardChoices().volume),
      );
    } catch (err) {
      setError(describeError(err));
    } finally {
      clearTimeout(timer);
      timer = setTimeout(
        () => setPlaying((id) => (id === sound.id ? undefined : id)),
        sound.duration_ms,
      );
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(timer);
    player?.stopAll();
  });

  // Add opens the name in the row, filled with the library name
  const [editing, setEditing] = createSignal<string>();
  const [draft, setDraft] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  function startAdding(sound: SoundLibrarySound) {
    setError(undefined);
    setDraft(name(sound));
    setEditing(sound.id);
  }
  async function add(sound: SoundLibrarySound) {
    if (busy() || !draft().trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const created = await addLibrarySound(client(), props.server, sound.id, {
        name: draft().trim(),
      });
      props.board.sounds.set(created._id, created);
      setEditing(undefined);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel data-sound-library>
      <Intro>
        <Trans>
          Ready-made sounds, free for everyone (CC0, from Kenney). Listen, then
          add the ones you like.
        </Trans>
      </Intro>
      <Filters>
        <FloatingSelect
          label={t`Category`}
          value={category()}
          onChange={(event) => {
            setCategory(event.currentTarget.value);
            setShown(PAGE);
          }}
        >
          <MenuItem value="">{t`All sounds`}</MenuItem>
          <For each={library()?.categories ?? []}>
            {(entry) => (
              <MenuItem value={entry.id}>
                {soundLibraryName(entry.names, locale())}
              </MenuItem>
            )}
          </For>
        </FloatingSelect>
        <TextField
          label={t`Search sounds`}
          name="sound-library-search"
          type="search"
          enterkeyhint="search"
          value={query()}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setShown(PAGE);
          }}
        />
      </Filters>

      <Show when={error()}>
        <Problem role="alert">{error()}</Problem>
      </Show>
      <Show when={props.canAdd && isFull()}>
        <Note>
          <Trans>
            The soundboard is full. Remove a sound, or add Wings to the server
            for more.
          </Trans>
        </Note>
      </Show>

      <Show
        when={!library.loading}
        fallback={
          <Note>
            <Trans>Loading…</Trans>
          </Note>
        }
      >
        <Show
          when={!library.error}
          fallback={
            <Problem role="alert">{describeError(library.error)}</Problem>
          }
        >
          <Show
            when={found().length}
            fallback={
              <Note data-library-empty>
                <Trans>No sounds match your search.</Trans>
              </Note>
            }
          >
            <Rows>
              <For each={visible()}>
                {(sound) => (
                  <Item data-library-sound={sound.id}>
                    <Glyph aria-hidden="true">{sound.emoji}</Glyph>
                    <Label>
                      <Title>{name(sound)}</Title>
                      <Meta>{t`${seconds(sound.duration_ms)} s`}</Meta>
                    </Label>
                    <Actions>
                      <IconButton
                        size="sm"
                        variant="tonal"
                        aria-label={t`Listen to ${name(sound)}`}
                        aria-pressed={playing() === sound.id}
                        data-preview-sound={sound.id}
                        onPress={() => void preview(sound)}
                      >
                        <Icon name="speaker-high" size={18} />
                      </IconButton>
                      <Show when={props.canAdd}>
                        <Show
                          when={!added().has(sound.id)}
                          fallback={
                            <Added data-library-added={sound.id}>
                              <Icon name="check-circle" size={18} />
                              <Trans>Added</Trans>
                            </Added>
                          }
                        >
                          <Show when={editing() !== sound.id}>
                            <Button
                              size="sm"
                              variant="tonal"
                              isDisabled={isFull()}
                              data-add-library-sound={sound.id}
                              onPress={() => startAdding(sound)}
                            >
                              <Trans>Add</Trans>
                            </Button>
                          </Show>
                        </Show>
                      </Show>
                    </Actions>
                    <Show when={props.canAdd && editing() === sound.id}>
                      <NameForm
                        onSubmit={(event) => {
                          event.preventDefault();
                          void add(sound);
                        }}
                      >
                        <TextField
                          label={t`Name`}
                          name="library-sound-name"
                          value={draft()}
                          maxlength={32}
                          counter
                          autoFocus
                          onInput={(event) =>
                            setDraft(event.currentTarget.value)
                          }
                        />
                        <Button
                          type="submit"
                          size="sm"
                          isDisabled={busy() || !draft().trim() || isFull()}
                          data-confirm-library-sound={sound.id}
                        >
                          <Trans>Add sound</Trans>
                        </Button>
                        <Button
                          size="sm"
                          variant="text"
                          onPress={() => setEditing(undefined)}
                        >
                          <Trans>Cancel</Trans>
                        </Button>
                      </NameForm>
                    </Show>
                  </Item>
                )}
              </For>
            </Rows>
            <Show when={found().length > shown()}>
              <More>
                <Button
                  size="sm"
                  variant="text"
                  onPress={() => setShown((count) => count + PAGE)}
                >
                  <Trans>Show more</Trans>
                </Button>
              </More>
            </Show>
          </Show>
        </Show>
      </Show>
    </Panel>
  );
}

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px 20px",
    minWidth: 0,
    _phone: { padding: "16px" },
  },
});

const Intro = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});

/** [Category ▾] [Search ....]; phones: one column */
const Filters = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(160px, 240px) minmax(0, 1fr)",
    gap: "12px",
    alignItems: "end",
    _phone: { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Rows = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

/** [emoji] name / length ............ [listen] [Add] */
const Item = styled("li", {
  base: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr) auto",
    alignItems: "center",
    columnGap: "12px",
    rowGap: "8px",
    padding: "8px 12px",
    borderRadius: "var(--z-radius-sm)",
    background: "var(--z-bg-input)",
  },
});

const Glyph = styled("span", {
  base: {
    display: "inline-grid",
    placeItems: "center",
    width: "24px",
    fontSize: "18px",
    lineHeight: 1,
  },
});

const Label = styled("div", {
  base: { display: "flex", flexDirection: "column", minWidth: 0 },
});

const Title = styled("span", {
  base: {
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Meta = styled("span", {
  base: { fontSize: "12px", lineHeight: "16px", color: "var(--z-fg-muted)" },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    // phones: 44 px targets
    _phone: { "& button": { minWidth: "44px", minHeight: "44px" } },
  },
});

const Added = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

/** The name, in the row, before adding; phones: one column */
const NameForm = styled("form", {
  base: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    alignItems: "end",
    gap: "8px",
    _phone: {
      gridTemplateColumns: "minmax(0, 1fr)",
      "& > button": { width: "100%", minHeight: "44px" },
    },
  },
});

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    color: "var(--z-fg-muted)",
  },
});

const Problem = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger)" },
});

const More = styled("div", {
  base: { display: "flex", justifyContent: "center" },
});
