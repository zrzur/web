import { createFormControl, createFormGroup } from "solid-forms";
import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useNavigate } from "@revolt/routing";
import {
  Column,
  Dialog,
  DialogProps,
  Form2,
  Radio2,
  SettingsRow,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to create a new server channel
 */
export function CreateChannelModal(
  props: DialogProps & Modals & { type: "create_channel" },
) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { showError } = useModals();

  const group = createFormGroup({
    name: createFormControl("", { required: true }),
    description: createFormControl(""),
    type: createFormControl<string>(props.initialType ?? "Text"),
  });

  // hidden from @everyone until access is given
  const [isPrivate, setPrivate] = createSignal(false);

  async function onSubmit() {
    try {
      const kind = group.controls.type.value;
      const description = group.controls.description.value.trim();
      const catId = props.categoryId;
      // one request: type, name, description, category and privacy
      const voiceRoom = kind === "Voice" || kind === "Stage";
      const channel = await props.server.createChannel({
        type: voiceRoom ? "Voice" : kind === "Forum" ? "Forum" : "Text",
        name: group.controls.name.value,
        ...(description ? { description } : {}),
        // a stage is a voice room with speakers and an audience
        ...(kind === "Stage" ? { voice: { stage: true } } : {}),
        ...(kind === "Announcement" ? { announcement: true } : {}),
        ...(catId && catId !== "default" ? { category: catId } : {}),
        ...(isPrivate() ? { private: true } : {}),
      } as Parameters<typeof props.server.createChannel>[0]);
      const newChId = channel.id;

      if (props.cb) {
        props.cb(channel);
      } else {
        navigate(`/server/${props.server.id}/channel/${newChId}`);
      }

      props.onClose();
    } catch (error) {
      showError(error);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      appearance="creation"
      tone="create"
      iconName={
        group.controls.type.value === "Voice"
          ? "speaker-high"
          : group.controls.type.value === "Stage"
            ? "waveform"
            : group.controls.type.value === "Announcement"
              ? "megaphone"
              : group.controls.type.value === "Forum"
                ? "note-pencil"
                : "hash"
      }
      showClose={false}
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Create channel</Trans>}
      description={
        props.server.categories?.find(
          (category) => category.id === props.categoryId,
        )?.title ?? <Trans>Channels are where your community talks.</Trans>
      }
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Create channel</Trans>,
          onClick: () => {
            onSubmit();
            return false;
          },
          isDisabled: !Form2.canSubmit(group),
          isLoading: group.isPending,
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <TypePicker>
            <legend>
              <Trans>Type</Trans>
            </legend>
            <Form2.Radio control={group.controls.type}>
              <Radio2.Option value="Text">
                <Icon name="hash" size={18} />
                <strong>
                  <Trans>Text</Trans>
                </strong>
              </Radio2.Option>
              <Radio2.Option value="Voice">
                <Icon name="speaker-high" size={18} />
                <strong>
                  <Trans>Voice</Trans>
                </strong>
              </Radio2.Option>
              <Radio2.Option value="Stage">
                <Icon name="waveform" size={18} />
                <strong>
                  <Trans context="channel-type">Stage</Trans>
                </strong>
              </Radio2.Option>
              <Radio2.Option value="Announcement">
                <Icon name="megaphone" size={18} />
                <strong>
                  <Trans>Announcement</Trans>
                </strong>
              </Radio2.Option>
              <Show when={!props.server.forumsDisabled}>
                <Radio2.Option value="Forum">
                  <Icon name="note-pencil" size={18} />
                  <strong>
                    <Trans>Forum</Trans>
                  </strong>
                </Radio2.Option>
              </Show>
            </Form2.Radio>
            <TypeHint>
              {group.controls.type.value === "Voice" ? (
                <Trans>Talk, video and screen sharing</Trans>
              ) : group.controls.type.value === "Stage" ? (
                <Trans>
                  Speakers talk, everyone else listens and can ask to speak.
                </Trans>
              ) : group.controls.type.value === "Announcement" ? (
                <Trans>
                  News and updates. Only moderators post, everyone reads.
                </Trans>
              ) : group.controls.type.value === "Forum" ? (
                <Trans>
                  Posts with a title and tags; each post has its own
                  conversation.
                </Trans>
              ) : (
                <Trans>Messages, images, GIFs and links</Trans>
              )}
            </TypeHint>
          </TypePicker>
          <Form2.TextField
            minlength={1}
            maxlength={32}
            counter
            name="name"
            control={group.controls.name}
            label={t`Channel name`}
            placeholder={
              group.controls.type.value === "Voice"
                ? t`Voice channel`
                : group.controls.type.value === "Stage"
                  ? t`Stage`
                  : "new-channel"
            }
            prefix={
              group.controls.type.value !== "Voice" &&
              group.controls.type.value !== "Stage"
                ? "#"
                : undefined
            }
          />
          <Form2.TextField
            maxlength={1024}
            name="description"
            control={group.controls.description}
            label={t`Description (optional)`}
            placeholder={t`What this channel is for`}
          />
          <SettingsRow
            icon={<Icon name="lock-simple" size={20} />}
            title={<Trans>Private channel</Trans>}
            description={
              <Trans>
                Only you and the roles or members you add can see it.
              </Trans>
            }
            control={(ids) => (
              <Toggle
                checked={isPrivate()}
                aria-labelledby={ids.labelId}
                onChange={() => setPrivate(!isPrivate())}
              />
            )}
          />
        </Column>
      </form>
    </Dialog>
  );
}

/**
 * Channel type: two equal choices side by side, the current one marked by
 * the accent border and a check; one line below says what it is for.
 * [ #  Text            ✓ ] [ 🔊 Voice            ]
 * Messages, images, GIFs and links
 */
const TypePicker = styled("fieldset", {
  base: {
    border: 0,
    padding: 0,
    margin: "0 0 6px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& legend": {
      padding: 0,
      marginBlockEnd: "8px",
      fontSize: "12px",
      fontWeight: 650,
      color: "var(--z-fg-muted)",
    },
    "& [role='radiogroup']": {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
    },
    "& label": {
      position: "relative",
      height: "48px",
      paddingInline: "14px",
      gap: "10px",
      borderRadius: "var(--z-radius, 10px)",
      border:
        "1px solid color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, white 3%, var(--z-bg-input)), var(--z-bg-input))",
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.04)",
      color: "var(--z-fg-secondary)",
      "--z-icon-color": "var(--z-icon-muted)",
      transition:
        "border-color 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease, color 0.14s ease",
      _hover: {
        borderColor: "color-mix(in srgb, var(--z-fg-primary) 20%, transparent)",
        color: "var(--z-fg-primary)",
      },
      _motionReduce: { transition: "none" },
    },
    // the radio dot becomes a small check at the end of the chosen option
    "& label > span[aria-hidden]": {
      order: 2,
      marginInlineStart: "auto",
      width: "18px",
      height: "18px",
      border: "none",
      background: "transparent",
    },
    "& label[data-checked='true'] > span[aria-hidden]": {
      background:
        "var(--z-accent-fill) center / 10px no-repeat url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.6l4.5-5' fill='none' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      borderRadius: "50%",
    },
    "& label > span:not([aria-hidden])": {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      minWidth: 0,
    },
    "& label strong": {
      fontSize: "14px",
      fontWeight: 600,
      color: "inherit",
    },
    "& label[data-checked='true']": {
      color: "var(--z-fg-primary)",
      borderColor: "var(--z-accent)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--z-accent) 14%, var(--z-bg-input)), color-mix(in srgb, var(--z-accent) 7%, var(--z-bg-input)))",
      boxShadow:
        "inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 0 1px var(--z-accent)",
      "--z-icon-color": "var(--z-accent)",
    },
    "& label:has(input:disabled)": { opacity: 0.5, cursor: "not-allowed" },
  },
});

const TypeHint = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});
