import { For, Show, createMemo } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { createFormControl, createFormGroup } from "solid-forms";
import { API, Server, ServerRole } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import {
  Button,
  ColourPicker,
  ColouredText,
  Column,
  Form2,
  SettingsFormPanel,
  SettingsMediaRow,
  SettingsRow,
  SettingsSection,
  Text,
  Toggle,
} from "@revolt/ui";
import { typography } from "@revolt/ui/components/design/Text";
import { Icon } from "@revolt/ui/icons/Icon";
import { createMaterialColourVariables } from "@revolt/ui/themes";

import { cropProcess } from "@revolt/modal/modals/CropProcess";
import { useSettingsNavigation } from "../../Settings";
import { ChannelPermissionsEditor } from "../../channel/permissions/ChannelPermissionsEditor";

function RoleColourPicker(props: {
  colour: string | null;
  roleName: string;
  onChange: (colour: string | null) => void;
}) {
  const { t } = useLingui();
  const state = useState();

  const colourPreviews = createMemo(() => {
    const theme = state.theme.activeTheme;

    return [
      {
        label: t`Light`,
        colours: createMaterialColourVariables(
          { ...theme, darkMode: false },
          "",
        ),
      },
      {
        label: t`Dark`,
        colours: createMaterialColourVariables(
          { ...theme, darkMode: true },
          "",
        ),
      },
    ];
  });

  return (
    <RoleColourControls>
      <ColourPicker
        label={<Trans>Role colour</Trans>}
        colour={props.colour}
        swatchLabel={(colour) => t`Set role colour to ${colour}`}
        onChange={props.onChange}
      />

      <ColourPreview>
        <Text class="label">
          <Trans>Preview</Trans>
        </Text>
        <For each={colourPreviews()}>
          {(preview) => (
            <PreviewSurface
              role="group"
              aria-label={preview.label}
              style={{
                background: preview.colours["surface-container-lowest"],
                color: preview.colours["on-surface"],
                "border-color": preview.colours["outline-variant"],
              }}
            >
              <PreviewMessage>
                <PreviewAvatar
                  style={{
                    background: preview.colours["surface-container-highest"],
                  }}
                />
                <PreviewMessageContent>
                  <PreviewUsername>
                    <ColouredText
                      colour={props.colour ?? preview.colours["on-surface"]}
                    >
                      {props.roleName.trim() || t`Role name`}
                    </ColouredText>
                  </PreviewUsername>
                  <PreviewBody>
                    <Trans>Zrzur rocks!</Trans>
                  </PreviewBody>
                </PreviewMessageContent>
              </PreviewMessage>
            </PreviewSurface>
          )}
        </For>
      </ColourPreview>
    </RoleColourControls>
  );
}

/**
 * Role editor
 */
export function ServerRoleEditor(props: { context: Server; roleId: string }) {
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const { navigate } = useSettingsNavigation();
  const instance = useInstance();

  const role = createMemo(
    () =>
      props.context.orderedRoles.find(
        (r) => r.id == props.roleId,
      ) as ServerRole,
  );

  /* eslint-disable solid/reactivity */
  const editGroup = createFormGroup({
    name: createFormControl(role()?.name || ""),
    icon: createFormControl<string | File[] | null>(role()?.icon?.originalUrl),
    colour: createFormControl(role()?.colour || null),
    hoist: createFormControl(role()?.hoist == true),
  });
  /* eslint-enable solid/reactivity */

  function selectColour(colour: string | null) {
    editGroup.controls.colour.setValue(colour);
    editGroup.controls.colour.markDirty(true);
  }

  async function onSubmit() {
    const changes: API.DataEditRole = {
      remove: [],
    };

    if (editGroup.controls.name.isDirty) {
      changes.name = editGroup.controls.name.value.trim();
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

    if (editGroup.controls.hoist.isDirty) {
      changes.hoist = editGroup.controls.hoist.value;
    }

    if (editGroup.controls.colour.isDirty) {
      if (editGroup.controls.colour.value === null) {
        changes.remove!.push("Colour");
      } else {
        changes.colour = editGroup.controls.colour.value;
      }
    }

    await props.context.editRole(props.roleId, changes);
  }

  function onReset() {
    editGroup.controls.name.setValue(role()?.name || "");
    editGroup.controls.icon.setValue(role()?.icon?.originalUrl || null);
    editGroup.controls.hoist.setValue(role()?.hoist || false);
    editGroup.controls.colour.setValue(role()?.colour || null);
  }

  const submit = Form2.useSubmitHandler(editGroup, onSubmit, onReset);

  // a role at or above your highest role: only someone higher may edit it
  const locked = () =>
    (role()?.rank ?? Infinity) <= (props.context.member?.ranking ?? Infinity);

  return (
    <Show
      when={!locked()}
      fallback={
        <SettingsSection title={role()?.name ?? ""}>
          <SettingsRow
            icon={<Icon name="lock-simple" size={20} />}
            title={<Trans>You can't change this role</Trans>}
            description={
              <Trans>
                It is at or above your highest role. Only someone higher can
                change it.
              </Trans>
            }
          />
        </SettingsSection>
      }
    >
      <Column gap="xl">
        <form onSubmit={(event) => event.preventDefault()}>
          <Column gap="xl">
            <SettingsSection title={<Trans>Role</Trans>}>
              <SettingsFormPanel>
                <Form2.TextField
                  minlength={1}
                  maxlength={32}
                  counter
                  name="name"
                  control={editGroup.controls.name}
                  label={t`Role name`}
                />
                <RoleColourPicker
                  colour={editGroup.controls.colour.value}
                  roleName={editGroup.controls.name.value}
                  onChange={selectColour}
                />
              </SettingsFormPanel>
            </SettingsSection>

            <SettingsSection title={<Trans>Display</Trans>}>
              <SettingsMediaRow
                picker={
                  <Form2.FileInput
                    control={editGroup.controls.icon}
                    accept="image/*"
                    label={t`Change role icon`}
                    removeLabel={t`Remove role icon`}
                    imageJustify={false}
                    imageHeight={56}
                    hideMaxSize
                    maxSize={instance.limits().file_upload_size_limits["icons"]}
                    process={cropProcess({
                      ratio: 1,
                      ratioLabel: t`Square`,
                      openModal,
                      allowModeToggle: false,
                      dialogTitle: t`Crop role icon`,
                    })}
                  />
                }
                title={<Trans>Role icon</Trans>}
                description={<Trans>Shown next to members' names.</Trans>}
              />
              <SettingsRow
                icon={<Icon name="list-bullets" size={20} />}
                title={<Trans>Show members separately</Trans>}
                description={
                  <Trans>
                    List members with this role in their own group in the member
                    list.
                  </Trans>
                }
                onClick={() => {
                  editGroup.controls.hoist.setValue(
                    !editGroup.controls.hoist.value,
                  );
                  editGroup.controls.hoist.markDirty(true);
                }}
                control={(ids) => (
                  <Toggle
                    checked={!!editGroup.controls.hoist.value}
                    onChange={(on) => {
                      editGroup.controls.hoist.setValue(on);
                      editGroup.controls.hoist.markDirty(true);
                    }}
                    aria-labelledby={ids.labelId}
                  />
                )}
              />
            </SettingsSection>
          </Column>
        </form>

        <ChannelPermissionsEditor
          type="server_role"
          context={props.context}
          roleId={props.roleId}
          saveLabel={t`Save changes`}
          additionalActions={{
            isDirty: () => editGroup.isDirty,
            isPending: () => editGroup.isPending,
            canSave: () => Form2.canSubmit(editGroup),
            save: () => submit(new Event("submit")),
            reset: () => Form2.reset(editGroup, onReset),
          }}
        />

        <SettingsSection title={<Trans>Manage</Trans>}>
          <SettingsRow
            icon={<Icon name="identification-card" size={20} />}
            title={<Trans>Role ID</Trans>}
            description={<code>{props.roleId}</code>}
            control={() => (
              <Button
                size="sm"
                variant="tonal"
                shape="square"
                onPress={() => navigator.clipboard.writeText(`${props.roleId}`)}
              >
                <Icon name="copy" size={16} />
                <Trans>Copy</Trans>
              </Button>
            )}
          />
          <SettingsRow
            icon={<Icon name="trash" size={20} />}
            danger
            title={<Trans>Delete role</Trans>}
            description={
              <Trans>Members lose this role and its permissions.</Trans>
            }
            control={() => (
              <Button
                size="sm"
                variant="_error"
                shape="square"
                onPress={() =>
                  openModal({
                    type: "delete_role",
                    role: role(),
                    cb: () => navigate("roles"),
                  })
                }
              >
                <Trans>Delete</Trans>
              </Button>
            )}
          />
        </SettingsSection>
      </Column>
    </Show>
  );
}

const RoleColourControls = styled("div", {
  base: {
    width: "100%",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: "var(--gap-lg)",
  },
});

const ColourPreview = styled("div", {
  base: {
    width: "220px",
    maxWidth: "100%",
    flex: "0 1 220px",
    display: "grid",
    gridTemplateRows: "auto repeat(2, minmax(0, 1fr))",
    gap: "var(--gap-md)",
  },
});

const PreviewSurface = styled("div", {
  base: {
    minHeight: "72px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "var(--gap-md)",
    paddingInline: "var(--gap-l)",
    border: "1px solid",
    borderRadius: "var(--borderRadius-md)",
  },
});

const PreviewMessage = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-md)",
  },
});

const PreviewAvatar = styled("span", {
  base: {
    width: "28px",
    height: "28px",
    flexShrink: 0,
    borderRadius: "50%",
  },
});

const PreviewMessageContent = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
});

const PreviewUsername = styled("span", {
  base: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    ...typography.raw({ class: "label", size: "large" }),
  },
});

const PreviewBody = styled("span", {
  base: {
    ...typography.raw({ class: "_messages" }),
  },
});
