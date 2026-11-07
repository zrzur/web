import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { billingPlans, levelPerks } from "@revolt/client/billing";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { cropProcess } from "@revolt/modal/modals/CropProcess";
import {
  Avatar,
  Button,
  Column,
  Form2,
  IconButton,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Emoji list: upload panel, then every emoji as a row
 */
export function EmojiList(props: { server: Server }) {
  const describeError = useError();
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const instance = useInstance();

  // supercharges raise the emoji slots; billing off keeps the global limit
  const limit = () => {
    const plans = billingPlans();
    if (!plans?.available) return instance.globalLimits.server_emoji;
    return (
      levelPerks(props.server.supercharge?.level)?.server_emoji ??
      plans.free_server_emoji
    );
  };
  const isFull = () => props.server.emojis.length >= limit();

  const editGroup = createFormGroup({
    name: createFormControl("", { required: true }),
    file: createFormControl<string | File[] | null>(null, {
      required: true,
    }),
  });

  const [uploading, setUploading] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const nameValid = () =>
    /^[a-z0-9_]{1,32}$/.test(editGroup.controls.name.value);
  const canCreate = () =>
    !isFull() &&
    !uploading() &&
    Array.isArray(editGroup.controls.file.value) &&
    nameValid();

  async function create() {
    if (!canCreate()) return;
    setError(undefined);
    setUploading(true);
    try {
      const id = await client().uploadFile(
        "emojis",
        (editGroup.controls.file.value as File[])[0],
        instance.mediaUrl,
      );

      await props.server.createEmoji(id, {
        name: editGroup.controls.name.value,
      });

      editGroup.controls.name.setValue("");
      editGroup.controls.file.setValue(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Column gap="xl">
      <SettingsSection
        title={<Trans>Upload emoji</Trans>}
        description={
          <Trans>
            {Math.max(0, limit() - props.server.emojis.length)} of {limit()}{" "}
            slots left. Members use them as :name:.
          </Trans>
        }
      >
        <form
          style={{ display: "contents" }}
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          {/* display:contents so Upload’s 16px padding is the card’s free content pad */}
          <Upload>
            <Tile>
              <Form2.FileInput
                control={editGroup.controls.file}
                accept="image/*"
                label={t`Choose emoji image`}
                imageJustify={false}
                imageRounded={false}
                imageHeight={44}
                allowRemoval={false}
                hideErrors
                hideMaxSize
                maxSize={instance.limits().file_upload_size_limits["emojis"]}
                process={cropProcess({
                  ratio: 1,
                  ratioLabel: t`Square`,
                  openModal,
                  dialogTitle: t`Crop emoji`,
                })}
              />
            </Tile>
            <Name>
              <Form2.TextField
                minlength={1}
                maxlength={32}
                counter
                name="name"
                control={editGroup.controls.name}
                label={t`Name`}
                placeholder={t`party_parrot`}
                autocomplete="off"
                spellcheck={false}
              />
            </Name>
            <Submit>
              <Button
                type="submit"
                size="md"
                shape="square"
                isDisabled={!canCreate()}
              >
                <Show when={uploading()} fallback={<Trans>Upload</Trans>}>
                  <Trans>Uploading…</Trans>
                </Show>
              </Button>
            </Submit>
            <Hint>
              <Show
                when={error()}
                fallback={
                  <Show
                    when={editGroup.controls.name.value && !nameValid()}
                    fallback={
                      <Trans>
                        A square image, then a name with lowercase letters,
                        numbers and underscores.
                      </Trans>
                    }
                  >
                    <ErrorText role="alert">
                      <Trans>
                        Use lowercase letters, numbers and underscores.
                      </Trans>
                    </ErrorText>
                  </Show>
                }
              >
                <ErrorText role="alert">{error()}</ErrorText>
              </Show>
            </Hint>
          </Upload>
        </form>
      </SettingsSection>

      <SettingsSection
        title={<Trans>{props.server.emojis.length} uploaded</Trans>}
      >
        <Show
          when={props.server.emojis.length}
          fallback={
            <SettingsRow
              icon={<Icon name="smiley" size={20} />}
              title={<Trans>No custom emojis yet</Trans>}
              description={<Trans>Upload one above to get started.</Trans>}
            />
          }
        >
          <For
            each={props.server.emojis.toSorted((b, a) =>
              a.id.localeCompare(b.id),
            )}
          >
            {(emoji) => (
              <SettingsRow
                icon={
                  <Avatar src={emoji.url} size={32} shape="rounded-square" />
                }
                title={<>:{emoji.name}:</>}
                description={
                  <Show when={emoji.creator}>
                    <Trans>Added by {emoji.creator!.displayName}</Trans>
                  </Show>
                }
                onClick={() => openModal({ type: "emoji_preview", emoji })}
                secondary={
                  <IconButton
                    variant="toolbar"
                    size="xs"
                    aria-label={t`Edit emoji`}
                    use:floating={{
                      tooltip: { placement: "top", content: t`Edit emoji` },
                    }}
                    onPress={() => openModal({ type: "edit_emoji", emoji })}
                  >
                    <Icon name="pencil-simple" size={18} />
                  </IconButton>
                }
                control={() => (
                  <Danger>
                    <IconButton
                      variant="toolbar"
                      size="xs"
                      aria-label={t`Delete emoji`}
                      use:floating={{
                        tooltip: { placement: "top", content: t`Delete emoji` },
                      }}
                      onPress={() => openModal({ type: "delete_emoji", emoji })}
                    >
                      <Icon name="trash" size={18} />
                    </IconButton>
                  </Danger>
                )}
              />
            )}
          </For>
        </Show>
      </SettingsSection>
    </Column>
  );
}

/**
 * Upload row: [image] [name ............] [Upload]
 *             hint or error
 * The image, the field and the button share one baseline (the field's
 * input), so the row reads as one line. Phones: the button takes the
 * width under the field.
 */
const Upload = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "end",
    columnGap: "16px",
    rowGap: "10px",
    padding: "16px 20px",
    _phone: {
      gridTemplateColumns: "auto minmax(0, 1fr)",
      padding: "16px",
    },
  },
});

const Tile = styled("div", {
  base: {
    flexShrink: 0,
    // the tile is as tall as the name input next to it
    "& > *": { margin: 0 },
  },
});

const Name = styled("div", {
  base: { minWidth: 0 },
});

const Submit = styled("div", {
  base: {
    display: "flex",
    _phone: {
      gridColumn: "1 / -1",
      "& > button": { width: "100%" },
    },
  },
});

const Hint = styled("p", {
  base: {
    gridColumn: "1 / -1",
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});

const ErrorText = styled("span", {
  base: {
    flexGrow: 1,
    fontSize: "13px",
    color: "var(--z-danger)",
  },
});

/** Delete turns red on hover, colour only */
const Danger = styled("span", {
  base: {
    "& button:hover": {
      "--z-icon-color": "var(--z-icon-danger) !important",
      "--colour": "var(--z-danger) !important",
    },
  },
});
