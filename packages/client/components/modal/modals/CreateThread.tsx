import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { validTagEmoji } from "@revolt/app/interface/settings/channel/tagEmoji";
import { TranslatedError } from "@revolt/i18n/errors";
import { Emoji } from "@revolt/markdown/emoji";
import { useNavigate } from "@revolt/routing";
import { Dialog, DialogProps, Form2 } from "@revolt/ui";

import { Modals } from "../types";
import { Tag } from "./ForumTag";

/**
 * Start a thread in a channel (from a message, or with a first message), or
 * a post in a forum: a title, the first message and its tags
 */
export function CreateThreadModal(
  props: DialogProps & Modals & { type: "create_thread" },
) {
  const { t } = useLingui();
  const navigate = useNavigate();
  // shown in this dialog, under the fields, so nothing typed is lost
  const [error, setError] = createSignal<unknown>();

  /* eslint-disable solid/reactivity */
  const forum = props.channel.forum;
  const group = createFormGroup({
    name: createFormControl(props.name ?? "", { required: true }),
    content: createFormControl("", { required: !!forum }),
    tags: createFormControl<string[]>([]),
  });
  /* eslint-enable solid/reactivity */

  const tagsMissing = () =>
    !!forum?.requireTag && group.controls.tags.value.length === 0;

  function toggleTag(id: string) {
    const tags = group.controls.tags.value;
    group.controls.tags.setValue(
      tags.includes(id) ? tags.filter((tag) => tag !== id) : [...tags, id],
    );
  }

  async function onSubmit() {
    if (tagsMissing()) return;
    setError(undefined);
    try {
      const content = group.controls.content.value.trim();
      const thread = await props.channel.createThread({
        name: group.controls.name.value.trim(),
        message: props.message?.id,
        content: content || undefined,
        tags: forum ? group.controls.tags.value : undefined,
      });
      props.onClose();
      navigate(`/server/${thread.serverId}/channel/${thread.id}`);
    } catch (error) {
      setError(error);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      tone="create"
      iconName={forum ? "note-pencil" : "chat-circle"}
      appearance="creation"
      showClose={false}
      show={props.show}
      onClose={props.onClose}
      title={forum ? <Trans>New post</Trans> : <Trans>Start a thread</Trans>}
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        {
          text: forum ? <Trans>Post</Trans> : <Trans>Start thread</Trans>,
          onClick: () => {
            void onSubmit();
            return false;
          },
          isDisabled: !Form2.canSubmit(group) || tagsMissing(),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Fields>
          <Form2.TextField
            minlength={1}
            maxlength={100}
            counter
            name="name"
            control={group.controls.name}
            label={forum ? t`Title` : t`Thread name`}
          />
          <Show when={!props.message}>
            <Form2.TextField
              maxlength={2000}
              rows={4}
              name="content"
              control={group.controls.content}
              label={forum ? t`Post text` : t`First message (optional)`}
            />
          </Show>
          <Show when={forum?.tags.length}>
            <fieldset>
              <legend>
                {forum!.requireTag ? (
                  <Trans>Tags (choose at least one)</Trans>
                ) : (
                  <Trans>Tags</Trans>
                )}
              </legend>
              <Tags>
                <For each={forum!.tags}>
                  {(tag) => (
                    <Tag
                      type="button"
                      aria-pressed={group.controls.tags.value.includes(tag.id)}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <Show when={validTagEmoji(tag.emoji)}>
                        {(emoji) => <Emoji emoji={emoji()} />}
                      </Show>
                      {tag.name}
                    </Tag>
                  )}
                </For>
              </Tags>
            </fieldset>
          </Show>
          <Show when={error()}>
            <Failure role="alert">
              <TranslatedError error={error()} />
            </Failure>
          </Show>
        </Fields>
      </form>
    </Dialog>
  );
}

const Fields = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "& fieldset": { border: "none", padding: 0, margin: 0 },
    "& legend": {
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--z-fg-secondary)",
      marginBottom: "8px",
    },
  },
});

/** The error, in plain words, with the technical part folded away */
const Failure = styled("div", {
  base: {
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
  },
});

const Tags = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});
