import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import {
  Avatar,
  Button,
  Column,
  Dialog,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../../Settings";

import { ChannelVisibility } from "./ChannelVisibility";

/**
 * Count set bits
 * @param v Number
 * @returns Set bits
 */
function countBits(v: bigint) {
  let bits = 0;
  for (let i = 0n; i < 52n; i++) {
    if (((1n << i) & v) === 1n << i) {
      bits++;
    }
  }

  return bits;
}

/**
 * Menu to select what permission set to change
 */
export function ChannelPermissionsOverview(props: { context: Channel }) {
  const { navigate } = useSettingsNavigation();
  const client = useClient();

  /** Members with an override of their own (for example a ticket's author) */
  const members = createMemo(() =>
    Object.entries(props.context.memberPermissions ?? {})
      .filter(([, value]) => countBits(value.a) > 0 || countBits(value.d) > 0)
      .map(([id, value]) => {
        const member = client().serverMembers.getByKey({
          server: props.context.serverId!,
          user: id,
        });
        const user = client().users.get(id);
        return {
          id,
          value,
          name: member?.displayName ?? user?.displayName ?? id,
          avatar: member?.animatedAvatarURL ?? user?.animatedAvatarURL,
        };
      }),
  );

  /** The category the channel is in, if any */
  const category = createMemo(() =>
    props.context.server?.categories?.find((c) =>
      c.channels.includes(props.context.id),
    ),
  );

  /** Role overrides that apply now: the category's when synced */
  const rolePermissions = createMemo(() => {
    const synced = props.context.syncedCategory as
      | { role_permissions?: Record<string, { a: number; d: number }> }
      | undefined;
    if (!synced) return props.context.rolePermissions;
    return Object.fromEntries(
      Object.entries(synced.role_permissions ?? {}).map(([id, value]) => [
        id,
        { a: BigInt(value.a), d: BigInt(value.d) },
      ]),
    );
  });

  const roles = createMemo(() => {
    const ordered = props.context.server?.orderedRoles;
    const overrides = rolePermissions();

    return {
      overrides: ordered?.filter(
        (role) =>
          countBits(overrides?.[role.id]?.a || 0n) > 0 ||
          countBits(overrides?.[role.id]?.d || 0n) > 0,
      ),
      withoutOverrides: ordered?.filter(
        (role) =>
          countBits(overrides?.[role.id]?.a || 0n) === 0 &&
          countBits(overrides?.[role.id]?.d || 0n) === 0,
      ),
    };
  });

  const describeError = useError();
  const [confirmSync, setConfirmSync] = createSignal(false);
  const [syncError, setSyncError] = createSignal<string>();

  async function sync() {
    try {
      await props.context.syncPermissions();
      setSyncError(undefined);
      setConfirmSync(false);
    } catch (error) {
      setSyncError(describeError(error));
    }
  }

  return (
    <Column gap="xl">
      <ChannelVisibility context={props.context} />

      <Show when={category()}>
        {(current) => (
          <SettingsSection title={<Trans>Category</Trans>}>
            <Show
              when={props.context.permissionsSynced}
              fallback={
                <SettingsRow
                  icon={<Icon name="lock-simple-open" size={20} />}
                  title={<Trans>Not synced with {current().title}</Trans>}
                  description={
                    syncError() ?? (
                      <Trans>This channel uses its own permissions.</Trans>
                    )
                  }
                  control={() => (
                    <Button
                      variant="tonal"
                      onPress={() => setConfirmSync(true)}
                    >
                      <Trans>Sync now</Trans>
                    </Button>
                  )}
                />
              }
            >
              <SettingsRow
                icon={<Icon name="link" size={20} />}
                title={<Trans>Synced with {current().title}</Trans>}
                description={
                  <Trans>
                    Permissions come from the category. Changing one here stops
                    following it.
                  </Trans>
                }
              />
            </Show>
            <Dialog
              tone="danger"
              show={confirmSync()}
              onClose={() => setConfirmSync(false)}
              title={<Trans>Sync with {current().title}?</Trans>}
              actions={[
                { text: <Trans>Cancel</Trans> },
                {
                  text: <Trans>Sync</Trans>,
                  onClick: () => {
                    void sync();
                    return false;
                  },
                },
              ]}
            >
              <Trans>
                The channel's own permissions for everyone and for roles are
                removed and it uses the category's. Member overrides stay.
              </Trans>
            </Dialog>
          </SettingsSection>
        )}
      </Show>

      <SettingsSection title={<Trans>Default permissions</Trans>}>
        <SettingsRow
          icon={<Icon name="users" size={20} />}
          title={<Trans>Everyone</Trans>}
          navigational
          description={
            <Trans>Permissions available when no role overrides apply</Trans>
          }
          onClick={() => navigate("permissions/default")}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Role overrides</Trans>}>
        <Show
          when={roles().overrides?.length}
          fallback={
            <SettingsRow
              icon={<Icon name="shield-check" size={20} />}
              title={<Trans>No role overrides have been configured.</Trans>}
            />
          }
        >
          <For each={roles().overrides}>
            {(role) => (
              <SettingsRow
                icon={
                  <RoleIcon
                    style={{
                      background: role.colour || "transparent",
                    }}
                    data-empty={!role.colour}
                  />
                }
                title={
                  <TitleLine>
                    <span style={{ color: role.colour ?? undefined }}>
                      {role.name}
                    </span>
                    <Show when={role.icon}>
                      <Avatar
                        shape="rounded-square"
                        src={role.icon!.previewUrl}
                        size={20}
                      />
                    </Show>
                  </TitleLine>
                }
                navigational
                onClick={() => navigate(`permissions/${role.id}`)}
                description={
                  <Trans>
                    Grants {countBits(rolePermissions()![role.id].a)}{" "}
                    permissions and denies{" "}
                    {countBits(rolePermissions()![role.id].d)} permissions
                  </Trans>
                }
              />
            )}
          </For>
        </Show>
      </SettingsSection>

      <Show when={members().length}>
        <SettingsSection title={<Trans>Member overrides</Trans>}>
          <For each={members()}>
            {(member) => (
              <SettingsRow
                icon={<Avatar src={member.avatar} size={20} />}
                title={member.name}
                navigational
                onClick={() => navigate(`permissions/@${member.id}`)}
                description={
                  <Trans>
                    Grants {countBits(member.value.a)} permissions and denies{" "}
                    {countBits(member.value.d)} permissions
                  </Trans>
                }
              />
            )}
          </For>
        </SettingsSection>
      </Show>

      <SettingsSection title={<Trans>Roles with No Overrides</Trans>}>
        <Show
          when={roles().withoutOverrides?.length}
          fallback={
            <SettingsRow
              icon={<Icon name="shield-check" size={20} />}
              title={<Trans>All roles have overrides.</Trans>}
            />
          }
        >
          <For each={roles().withoutOverrides}>
            {(role) => (
              <SettingsRow
                icon={
                  <RoleIcon
                    style={{
                      background: role.colour || "transparent",
                    }}
                    data-empty={!role.colour}
                  />
                }
                title={
                  <TitleLine>
                    <span style={{ color: role.colour ?? undefined }}>
                      {role.name}
                    </span>
                    <Show when={role.icon}>
                      <Avatar
                        shape="rounded-square"
                        src={role.icon!.previewUrl}
                        size={20}
                      />
                    </Show>
                  </TitleLine>
                }
                navigational
                onClick={() => navigate(`permissions/${role.id}`)}
                description={<Trans>No permissions set yet</Trans>}
              />
            )}
          </For>
        </Show>
      </SettingsSection>
    </Column>
  );
}

const RoleIcon = styled("span", {
  base: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    flexShrink: 0,
    "&[data-empty=true]": {
      border: "2px dashed var(--z-fg-muted)",
    },
  },
});

const TitleLine = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
});
