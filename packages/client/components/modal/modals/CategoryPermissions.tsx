import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { ChannelPermissionsEditor } from "@revolt/app/interface/settings/channel/permissions/ChannelPermissionsEditor";
import {
  Button,
  Column,
  Dialog,
  DialogProps,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

type Overrides = Record<string, { a: number; d: number }>;

/**
 * A category's permissions: channels synced with the category use them
 */
export function CategoryPermissionsModal(
  props: DialogProps & Modals & { type: "category_permissions" },
) {
  /** null: the list; "default": everyone; otherwise a role id */
  const [page, setPage] = createSignal<string | null>(null);

  const category = createMemo(
    () =>
      props.server.categories?.find((c) => c.id === props.category.id) as
        | { role_permissions?: Overrides }
        | undefined,
  );

  const roles = createMemo(() => {
    const overrides = category()?.role_permissions ?? {};
    const ordered = props.server.orderedRoles ?? [];
    return {
      set: ordered.filter((role) => overrides[role.id]),
      unset: ordered.filter((role) => !overrides[role.id]),
    };
  });

  const syncedCount = () =>
    props.category.channels.filter((channel) => channel.permissionsSynced)
      .length;

  return (
    <Dialog
      size="lg"
      iconName="lock-simple"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Permissions of {props.category.title}</Trans>}
      actions={[{ text: <Trans>Done</Trans> }]}
    >
      <Switch>
        <Match when={page() === null}>
          <Column gap="xl">
            <p>
              <Trans>
                Channels synced with this category use these permissions:{" "}
                {syncedCount()} of {props.category.channels.length}.
              </Trans>
            </p>
            <SettingsSection title={<Trans>Default permissions</Trans>}>
              <SettingsRow
                icon={<Icon name="users" size={20} />}
                title={<Trans>Everyone</Trans>}
                navigational
                onClick={() => setPage("default")}
              />
            </SettingsSection>
            <SettingsSection title={<Trans>Role overrides</Trans>}>
              <For each={roles().set}>
                {(role) => (
                  <SettingsRow
                    icon={<Icon name="shield-check" size={20} />}
                    title={role.name}
                    navigational
                    onClick={() => setPage(role.id)}
                  />
                )}
              </For>
              <Show when={!roles().set.length}>
                <SettingsRow
                  icon={<Icon name="shield-check" size={20} />}
                  title={<Trans>No role overrides have been configured.</Trans>}
                />
              </Show>
            </SettingsSection>
            <Show when={roles().unset.length}>
              <SettingsSection title={<Trans>Add a role</Trans>}>
                <For each={roles().unset}>
                  {(role) => (
                    <SettingsRow
                      icon={<Icon name="plus" size={20} />}
                      title={role.name}
                      navigational
                      onClick={() => setPage(role.id)}
                    />
                  )}
                </For>
              </SettingsSection>
            </Show>
          </Column>
        </Match>
        <Match when={page()}>
          {(current) => (
            <Column gap="md">
              <Back>
                <Button variant="text" onPress={() => setPage(null)}>
                  <Icon name="arrow-left" size={16} />
                  <Trans>All permissions</Trans>
                </Button>
              </Back>
              <Show
                when={current() !== "default"}
                fallback={
                  <ChannelPermissionsEditor
                    type="category_default"
                    context={props.server}
                    categoryId={props.category.id}
                  />
                }
              >
                <ChannelPermissionsEditor
                  type="category_role"
                  context={props.server}
                  categoryId={props.category.id}
                  roleId={current()}
                />
              </Show>
            </Column>
          )}
        </Match>
      </Switch>
    </Dialog>
  );
}

/** The back arrow points the other way in right-to-left languages */
const Back = styled("div", {
  base: {
    // direction icons turn by themselves in right-to-left (styles.css)
  },
});
