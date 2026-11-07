import { createFormControl, createFormGroup } from "solid-forms";
import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { isolate } from "@revolt/common/lib/isolate";
import { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  Avatar,
  Button,
  Dialog,
  DialogProps,
  Form2,
  humanFileSize,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

import { cropProcess } from "./CropProcess";

/**
 * Per-server identity: avatar on the start side, nickname and pronouns on
 * the end side.
 *
 * [ (avatar) ] [ Nickname          ]
 * [  change  ] [ Pronouns          ]
 * [  remove  ]
 *
 * Moderators changing someone else's nickname get the same layout with a
 * read-only avatar and only the nickname field.
 */
export function ServerIdentityModal(
  props: DialogProps & Modals & { type: "server_identity" },
) {
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const describeError = useError();
  const instance = useInstance();

  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();

  /* eslint-disable solid/reactivity */
  const self = !!props.member.user?.self;
  const group = createFormGroup({
    avatar: createFormControl<string | File[] | null>(
      props.member.avatar ? props.member.animatedAvatarURL : null,
    ),
    pronouns: createFormControl<string>(props.member.pronouns ?? ""),
    nickname: createFormControl(props.member.nickname ?? ""),
  });
  /* eslint-enable solid/reactivity */

  const avatarLimit = () =>
    instance.limits().file_upload_size_limits["avatars"];

  async function onSubmit() {
    if (saving()) return;
    setError(undefined);
    setSaving(true);
    try {
      const changes: API.DataMemberEdit = {
        remove: [],
      };

      if (group.controls.nickname.isDirty) {
        const nickname = group.controls.nickname.value.trim();
        if (nickname) {
          changes.nickname = nickname;
        } else {
          changes.remove!.push("Nickname");
        }
      }

      if (group.controls.avatar.isDirty) {
        if (!group.controls.avatar.value) {
          changes.remove!.push("Avatar");
        } else if (Array.isArray(group.controls.avatar.value)) {
          changes.avatar = await client().uploadFile(
            "avatars",
            group.controls.avatar.value[0],
            instance.mediaUrl,
          );
        }
      }

      if (group.controls.pronouns.isDirty) {
        const pronouns = group.controls.pronouns.value.trim();
        if (pronouns) {
          changes.pronouns = pronouns;
        } else {
          changes.remove!.push("Pronouns");
        }
      }

      await props.member.edit(changes);
      props.onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  function removeAvatar() {
    group.controls.avatar.setValue(null);
    group.controls.avatar.markDirty(true);
  }

  return (
    <Dialog
      tone="edit"
      iconName="identification-card"
      show={props.show}
      onClose={props.onClose}
      size="lg"
      title={
        <Show
          when={self}
          fallback={
            <Trans>
              Change{" "}
              {props.member.nickname ??
                props.member.user?.displayName ??
                props.member.user?.username}
              's nickname
            </Trans>
          }
        >
          <Trans>Change identity on {isolate(props.member.server!.name)}</Trans>
        </Show>
      }
      description={
        <Show
          when={self}
          fallback={<Trans>Only shown on {props.member.server!.name}.</Trans>}
        >
          <Trans>Server only. Empty fields use your main profile.</Trans>
        </Show>
      }
      error={error()}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Save</Trans>,
          // the dialog closes itself on success; errors stay inline
          onClick: () => {
            onSubmit();
            return false;
          },
          isLoading: saving(),
          isDisabled: !Form2.canSubmit(group),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Layout>
          <Side>
            <Show
              when={self}
              fallback={
                <Avatar
                  src={props.member.animatedAvatarURL}
                  fallback={props.member.user?.displayName}
                  size={112}
                />
              }
            >
              <AvatarPicker
                style={{
                  "--main-avatar": props.member.user?.animatedAvatarURL
                    ? `url('${props.member.user.animatedAvatarURL}')`
                    : undefined,
                }}
              >
                <Form2.FileInput
                  control={group.controls.avatar}
                  accept="image/*"
                  label={t`Change server avatar`}
                  imageJustify={false}
                  imageHeight={112}
                  allowRemoval={false}
                  hideMaxSize
                  maxSize={avatarLimit()}
                  process={cropProcess({
                    ratio: 1,
                    ratioLabel: t`Square`,
                    openModal,
                    allowModeToggle: false,
                    dialogTitle: t`Crop avatar`,
                    circularMask: true,
                  })}
                />
              </AvatarPicker>
              <Hint>
                <Show
                  when={group.controls.avatar.value}
                  fallback={<Trans>Using your main avatar</Trans>}
                >
                  <Trans>Server avatar</Trans>
                </Show>
                <span>
                  <Trans>Up to {humanFileSize(avatarLimit())}</Trans>
                </span>
              </Hint>
              <Show when={group.controls.avatar.value}>
                <Button
                  size="sm"
                  shape="square"
                  variant="text"
                  onPress={removeAvatar}
                >
                  <Icon name="trash" size={16} />
                  <Trans>Remove</Trans>
                </Button>
              </Show>
            </Show>
          </Side>

          <Fields>
            <Form2.TextField
              minlength={1}
              maxlength={32}
              counter
              name="nickname"
              label={t`Nickname`}
              control={group.controls.nickname}
              placeholder={props.member.user?.displayName}
              autocomplete="off"
            />
            <Show when={self}>
              <Form2.TextField
                minlength={1}
                maxlength={24}
                counter
                name="pronouns"
                control={group.controls.pronouns}
                label={t`Pronouns`}
                placeholder={props.member.user?.pronouns ?? t`e.g. they/them`}
                autocomplete="off"
              />
            </Show>
          </Fields>
        </Layout>
      </form>
    </Dialog>
  );
}

const Layout = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "148px minmax(0, 1fr)",
    alignItems: "start",
    gap: "24px",

    "@media (max-width: 520px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "16px",
    },
  },
});

const Side = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    paddingTop: "4px",
    textAlign: "center",
  },
});

/**
 * Circular preview with the shared hover/upload overlay. With no server
 * avatar it shows the main avatar, faded, so it is clear what is in use.
 */
const AvatarPicker = styled("div", {
  base: {
    "& [role='button']": {
      borderRadius: "50%",
    },
    "& [role='button'][data-empty='true']": {
      backgroundImage:
        "linear-gradient(rgba(10, 12, 16, 0.55), rgba(10, 12, 16, 0.55)), var(--main-avatar, none)",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  },
});

const Hint = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",

    "& span": {
      fontWeight: 400,
      color: "var(--z-fg-muted)",
    },
  },
});

const Fields = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});
