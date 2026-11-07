import { createFormControl, createFormGroup } from "solid-forms";
import { createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  Column,
  Form2,
  SettingsIdentityPanel,
  SettingsMediaRow,
  SettingsSection,
  humanFileSize,
} from "@revolt/ui";

import { useModals } from "@revolt/modal";
import { cropProcess } from "@revolt/modal/modals/CropProcess";
import { ServerSettingsProps } from "../ServerSettings";
import { SaveSlot } from "./pageSave";

/** What the profile fields hold while being edited */
export type ProfileDraft = {
  name: string;
  description: string;
  icon: string | File[] | null;
  banner: string | File[] | null;
};

/**
 * Server profile: icon, banner, name and description
 */
export default function ServerOverview(
  props: ServerSettingsProps & {
    /** Called with what the fields hold right now (for the live preview) */
    onDraft?: (draft: ProfileDraft) => void;
  },
) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const { openModal } = useModals();
  const describeError = useError();

  /* eslint-disable solid/reactivity */
  const editGroup = createFormGroup({
    name: createFormControl(props.server.name),
    description: createFormControl(props.server.description || ""),
    icon: createFormControl<string | File[] | null>(
      props.server.animatedIconURL,
    ),
    banner: createFormControl<string | File[] | null>(props.server.bannerURL),
  });

  /* eslint-enable solid/reactivity */

  // update fields (if they are not dirty) ourselves:
  createEffect(
    on(
      () => props.server.name,
      (name) =>
        !editGroup.controls.name.isDirty &&
        editGroup.controls.name.setValue(name),
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.server.description,
      (description) =>
        !editGroup.controls.description.isDirty &&
        editGroup.controls.description.setValue(description ?? ""),
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.server.animatedIconURL,
      (icon) =>
        !editGroup.controls.icon.isDirty &&
        editGroup.controls.icon.setValue(icon ?? null),
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.server.bannerURL,
      (banner) =>
        !editGroup.controls.banner.isDirty &&
        editGroup.controls.banner.setValue(banner ?? null),
      { defer: true },
    ),
  );

  createEffect(() =>
    props.onDraft?.({
      name: editGroup.controls.name.value,
      description: editGroup.controls.description.value,
      icon: editGroup.controls.icon.value,
      banner: editGroup.controls.banner.value,
    }),
  );

  function onReset() {
    editGroup.controls.name.setValue(props.server.name);
    editGroup.controls.description.setValue(props.server.description || "");
    editGroup.controls.icon.setValue(props.server.animatedIconURL ?? null);
    editGroup.controls.banner.setValue(props.server.bannerURL ?? null);
  }

  async function onSubmit() {
    const changes: Parameters<Server["edit"]>[0] = { remove: [] };

    if (editGroup.controls.name.isDirty) {
      changes.name = editGroup.controls.name.value.trim();
    }

    if (editGroup.controls.description.isDirty) {
      const description = editGroup.controls.description.value.trim();

      if (description) {
        changes.description = description;
      } else {
        changes.remove!.push("Description");
      }
    }

    if (editGroup.controls.icon.isDirty) {
      if (!editGroup.controls.icon.value) {
        changes.remove!.push("Icon");
      } else if (Array.isArray(editGroup.controls.icon.value)) {
        changes.icon = await client().uploadFile(
          "icons",
          editGroup.controls.icon.value[0],
          instance.mediaUrl,
        );
      }
    }

    if (editGroup.controls.banner.isDirty) {
      if (!editGroup.controls.banner.value) {
        changes.remove!.push("Banner");
      } else if (Array.isArray(editGroup.controls.banner.value)) {
        changes.banner = await client().uploadFile(
          "banners",
          editGroup.controls.banner.value[0],
          instance.mediaUrl,
        );
      }
    }

    await props.server.edit(changes);
  }

  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function save() {
    if (saving() || !editGroup.isDirty) return;
    setError(undefined);
    setSaving(true);
    try {
      await onSubmit();
      for (const control of Object.values(editGroup.controls))
        control.markDirty(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    onReset();
    for (const control of Object.values(editGroup.controls))
      control.markDirty(false);
    setError(undefined);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Column gap="xl">
        <SettingsSection>
          <SettingsIdentityPanel
            picker={
              <Form2.FileInput
                control={editGroup.controls.icon}
                accept="image/*"
                label={t`Change server icon`}
                removeLabel={t`Remove server icon`}
                imageJustify={false}
                imageHeight={96}
                hideMaxSize
                maxSize={instance.limits().file_upload_size_limits["icons"]}
                process={cropProcess({
                  ratio: 1,
                  ratioLabel: t`Square`,
                  openModal,
                  circularMask: true,
                  allowModeToggle: false,
                  dialogTitle: t`Crop server icon`,
                })}
              />
            }
            caption={
              <Trans>
                Square, 512 × 512 px, up to{" "}
                {humanFileSize(
                  instance.limits().file_upload_size_limits["icons"],
                )}
                .
              </Trans>
            }
          >
            <Form2.TextField
              minlength={1}
              maxlength={32}
              counter
              name="name"
              control={editGroup.controls.name}
              label={t`Server name`}
            />
            <Form2.TextField
              autosize
              min-rows={3}
              maxlength={1024}
              counter
              name="description"
              control={editGroup.controls.description}
              label={t`Description`}
              placeholder={t`This server is about...`}
              helper={t`Shown in the server info and invites. Markdown is supported.`}
            />
          </SettingsIdentityPanel>
          <SettingsMediaRow
            picker={
              <Form2.FileInput
                control={editGroup.controls.banner}
                accept="image/*"
                label={t`Change server banner`}
                removeLabel={t`Remove server banner`}
                imageAspect="16/9"
                imageRounded={false}
                imageJustify={false}
                imageHeight={72}
                hideMaxSize
                maxSize={instance.limits().file_upload_size_limits["banners"]}
                process={cropProcess({
                  ratio: 16 / 9,
                  ratioLabel: t`Banner`,
                  openModal,
                  allowModeToggle: false,
                  dialogTitle: t`Crop server banner`,
                  // sharp on large screens, small enough to load fast
                  maxWidth: 2560,
                  outputType: "image/webp",
                  outputQuality: 0.92,
                })}
              />
            }
            title={<Trans>Server banner</Trans>}
            description={
              <Trans>
                Recommended: 1920 × 1080 px (16:9) or larger. Up to{" "}
                {humanFileSize(
                  instance.limits().file_upload_size_limits["banners"],
                )}
                . Edges may be cropped above the channel list; keep important
                details in the center.
              </Trans>
            }
          />
        </SettingsSection>

        <SaveSlot
          show={editGroup.isDirty}
          saving={saving()}
          error={error()}
          onReset={reset}
        />
      </Column>
    </form>
  );
}
