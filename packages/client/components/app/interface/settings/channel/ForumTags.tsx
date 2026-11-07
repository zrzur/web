import { For, Show, createEffect, createSignal, on, onCleanup } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel, ForumTag } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";
import { ulid } from "ulid";

import { useError } from "@revolt/i18n";
import { Emoji } from "@revolt/markdown/emoji";
import {
  Button,
  Column,
  IconButton,
  SettingsRow,
  SettingsSaveBar,
  SettingsSection,
  TextField,
  Toggle,
} from "@revolt/ui";
import { CompositionMediaPicker } from "@revolt/ui/components/features/messaging/composition/picker/CompositionMediaPicker";
import { Icon } from "@revolt/ui/icons/Icon";

import { tagEmojiFromPicker, validTagEmoji } from "./tagEmoji";

/** The API takes at most this many tags */
const MAX_TAGS = 20;
/** Longest tag name the API takes */
const MAX_NAME = 20;

/**
 * A forum's tags: posts carry up to five of them, and the forum can ask for
 * at least one on every post.
 *
 * The rows live in a store and are changed by path (`setTags(i, "name", …)`):
 * replacing a tag object on every key press made `<For>` rebuild the row,
 * so each field took one character and lost focus.
 */
export function ForumTags(props: { channel: Channel }) {
  const { t } = useLingui();
  const describeError = useError();

  // tags saved before the server checked emoji may hold plain text:
  // those start with no emoji, so the next save cleans them up
  const stored = (): ForumTag[] =>
    (props.channel.forum?.tags ?? []).map(({ emoji, ...tag }) => {
      const valid = validTagEmoji(emoji);
      return valid ? { ...tag, emoji: valid } : tag;
    });
  // the editor starts from what is saved; reset() takes it again
  /* eslint-disable solid/reactivity */
  const [tags, setTags] = createStore<ForumTag[]>(structuredClone(stored()));
  const [requireTag, setRequireTag] = createSignal(
    !!props.channel.forum?.requireTag,
  );
  /* eslint-enable solid/reactivity */
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();
  // the tag waiting for "Remove?" to be confirmed
  const [removing, setRemoving] = createSignal<string>();
  // the confirmation takes keyboard focus ("Keep", the safe choice); Keep and
  // Escape hand it back to the trash button they came from
  const trashButton = (id: string) =>
    document.querySelector<HTMLElement>(`[data-trash-tag="${id}"]`);
  const addTagButton = () =>
    [...document.querySelectorAll<HTMLElement>('[role="button"]')].find((el) =>
      el.textContent?.includes(t`Add tag`),
    );
  createEffect(
    on(
      removing,
      (id) => {
        if (!id) return;
        queueMicrotask(() =>
          document.querySelector<HTMLElement>("[data-keep-tag]")?.focus(),
        );
        // Escape cancels the confirmation (and nothing else)
        const onKey = (e: KeyboardEvent) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          e.stopImmediatePropagation();
          setRemoving(undefined);
          queueMicrotask(() => trashButton(id)?.focus());
        };
        document.addEventListener("keydown", onKey, true);
        onCleanup(() => document.removeEventListener("keydown", onKey, true));
      },
      { defer: true },
    ),
  );

  const plain = () => unwrap(tags);
  // read through the store (not unwrap) so every edit re-checks this
  const dirty = () =>
    JSON.stringify(tags) !== JSON.stringify(stored()) ||
    requireTag() !== !!props.channel.forum?.requireTag;
  const valid = () =>
    tags.every(
      (tag) => tag.name.trim().length > 0 && tag.name.length <= MAX_NAME,
    );

  function add() {
    setTags(tags.length, { id: ulid().slice(-12), name: "" });
    // the new row's name field takes the focus (the rows are followed by
    // "Add tag", so the new row is the last row, not the last child)
    queueMicrotask(() =>
      [...document.querySelectorAll<HTMLInputElement>("[data-tag-row] input")]
        .at(-1)
        ?.focus(),
    );
  }

  function remove(id: string) {
    const at = tags.findIndex((tag) => tag.id === id);
    setTags((list) => list.filter((tag) => tag.id !== id));
    setRemoving(undefined);
    // the focused button is gone: go to the next row's trash, else "Add tag"
    queueMicrotask(() =>
      (
        document.querySelectorAll<HTMLElement>("[data-trash-tag]")[at] ??
        addTagButton()
      )?.focus(),
    );
  }

  function reset() {
    setTags(reconcile(structuredClone(stored())));
    setRequireTag(!!props.channel.forum?.requireTag);
    setRemoving(undefined);
    setError(undefined);
  }

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      await props.channel.edit({
        forum_tags: plain().map((tag) => ({
          id: tag.id,
          name: tag.name.trim(),
          ...(tag.emoji ? { emoji: tag.emoji } : {}),
        })),
        require_tag: requireTag(),
      } as Parameters<typeof props.channel.edit>[0]);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Column gap="xl">
      <SettingsSection
        title={<Trans>Tags</Trans>}
        description={
          <Trans>
            Members pick up to five tags for each post, and everyone can filter
            posts by tag.
          </Trans>
        }
      >
        <Show
          when={tags.length}
          fallback={
            <SettingsRow
              icon={<Icon name="bookmark-simple" size={20} />}
              title={<Trans>No tags yet.</Trans>}
              description={<Trans>Add one so members can sort posts.</Trans>}
            />
          }
        >
          <For each={tags}>
            {(tag, index) => (
              <TagRow data-tag-row>
                <Show
                  when={removing() === tag.id}
                  fallback={
                    <>
                      <CompositionMediaPicker
                        channel={props.channel}
                        closeOnPick
                        placement="bottom-start"
                        onMessage={() => undefined}
                        onTextReplacement={(text) =>
                          setTags(index(), "emoji", tagEmojiFromPicker(text))
                        }
                      >
                        {(picker) => (
                          <EmojiButton
                            ref={picker.ref}
                            type="button"
                            aria-label={
                              tag.emoji
                                ? t`Change the emoji of ${tag.name}`
                                : t`Choose an emoji`
                            }
                            onClick={(event) => picker.onClickEmoji(event)}
                          >
                            <Show
                              when={tag.emoji}
                              fallback={<Icon name="smiley" size={20} />}
                            >
                              <Emoji emoji={tag.emoji!} />
                            </Show>
                          </EmojiButton>
                        )}
                      </CompositionMediaPicker>
                      <NameField>
                        <TextField
                          value={tag.name}
                          maxlength={MAX_NAME}
                          placeholder={t`Tag name`}
                          aria-label={t`Tag name`}
                          onInput={(e) =>
                            setTags(index(), "name", e.currentTarget.value)
                          }
                        />
                      </NameField>
                      <Counter aria-hidden="true">
                        {tag.name.length}/{MAX_NAME}
                      </Counter>
                      <Show when={tag.emoji}>
                        <IconButton
                          variant="toolbar"
                          size="xs"
                          aria-label={t`Remove the emoji`}
                          onPress={() => setTags(index(), "emoji", undefined)}
                        >
                          <Icon name="x" size={16} />
                        </IconButton>
                      </Show>
                      <IconButton
                        variant="toolbar"
                        size="xs"
                        aria-label={t`Remove tag ${tag.name}`}
                        data-trash-tag={tag.id}
                        onPress={() => setRemoving(tag.id)}
                      >
                        <span
                          style={{ "--z-icon-color": "var(--z-icon-danger)" }}
                        >
                          <Icon name="trash" size={18} />
                        </span>
                      </IconButton>
                    </>
                  }
                >
                  <Confirm role="alert" data-owns-escape>
                    <Trans>Remove “{tag.name || t`this tag`}”?</Trans>
                  </Confirm>
                  <Button
                    size="sm"
                    variant="text"
                    data-keep-tag
                    onPress={() => {
                      setRemoving(undefined);
                      queueMicrotask(() => trashButton(tag.id)?.focus());
                    }}
                  >
                    <Trans>Keep</Trans>
                  </Button>
                  <Button
                    size="sm"
                    variant="error"
                    onPress={() => remove(tag.id)}
                  >
                    <Trans>Remove</Trans>
                  </Button>
                </Show>
              </TagRow>
            )}
          </For>
        </Show>
        <SettingsRow
          navigational
          disabled={tags.length >= MAX_TAGS}
          icon={<Icon name="plus" size={20} />}
          title={<Trans>Add tag</Trans>}
          description={
            <Show when={tags.length >= MAX_TAGS}>
              <Trans>A forum has at most {MAX_TAGS} tags.</Trans>
            </Show>
          }
          onClick={add}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Posting</Trans>}>
        <SettingsRow
          icon={<Icon name="list-checks" size={20} />}
          title={<Trans>Every post needs a tag</Trans>}
          description={
            <Trans>New posts need at least one of the tags above.</Trans>
          }
          onClick={() => setRequireTag(!requireTag())}
          control={(ids) => (
            <Toggle
              checked={requireTag()}
              aria-labelledby={ids.labelId}
              onChange={() => setRequireTag(!requireTag())}
            />
          )}
        />
      </SettingsSection>

      <SettingsSaveBar
        show={dirty()}
        saving={saving()}
        error={error()}
        canSave={valid()}
        onReset={reset}
        onSave={() => void save()}
      />
    </Column>
  );
}

/** One tag: emoji, name, remove — the same row height as settings rows */
const TagRow = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "52px",
    paddingBlock: "8px",
    paddingInline: "16px",

    // the inset hairline between rows, as in SettingsRow
    "& + &::before": {
      content: "''",
      position: "absolute",
      top: 0,
      insetInlineStart: "16px",
      insetInlineEnd: "16px",
      height: "1px",
      background: "var(--z-border-subtle)",
    },
    _phone: { minHeight: "56px" },
  },
});

const EmojiButton = styled("button", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "40px",
    height: "40px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-field-border, var(--z-border-soft))",
    background: "var(--z-bg-input)",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-muted)",
    "--emoji-size": "22px",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { width: "44px", height: "44px" },
  },
});

const NameField = styled("div", {
  base: { flex: "1 1 auto", minWidth: 0 },
});

const Counter = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    color: "var(--z-fg-muted)",
  },
});

const Confirm = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    fontSize: "14px",
    color: "var(--z-fg-primary)",
  },
});
