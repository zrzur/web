import { For, Show, createMemo } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Avatar, Column, SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";
import {
  VisibilitySection,
  pairs,
} from "../channel/permissions/VisibilitySection";
import { pair } from "../channel/permissions/visibility";

import {
  type CategoryContext,
  channelsOf,
  findCategory,
  isPrivateCategory,
  openToEveryone,
  seenByRoleOutside,
} from "./category";

/** Count set bits */
function countBits(v: bigint) {
  let bits = 0;
  for (let i = 0n; i < 52n; i++) {
    if (((1n << i) & v) === 1n << i) bits++;
  }
  return bits;
}

/**
 * A category's permissions: who can see it, then every permission for
 * everyone and per role. Channels that follow the category use them.
 */
export function CategoryPermissionsOverview(props: {
  context: CategoryContext;
}) {
  const { t } = useLingui();
  const { navigate } = useSettingsNavigation();

  const category = createMemo(() => findCategory(props.context));
  const overrides = createMemo(() => ({
    everyone: pair(category()?.default_permissions ?? undefined),
    roles: pairs(category()?.role_permissions),
  }));

  const roles = createMemo(() => {
    const ordered = props.context.server.orderedRoles ?? [];
    const set = (id: string) => {
      const value = overrides().roles[id];
      return !!value && (value.a !== 0n || value.d !== 0n);
    };
    return {
      overrides: ordered.filter((role) => set(role.id)),
      withoutOverrides: ordered.filter((role) => !set(role.id)),
    };
  });

  /**
   * Channels a private category does not hide: they have their own
   * permissions, and everyone or a role kept out of the category sees them
   */
  const stillOpen = createMemo(() => {
    const current = category();
    const serverDefault = props.context.server.defaultPermissions;
    if (!current || !isPrivateCategory(serverDefault, current)) return [];
    const ordered = props.context.server.orderedRoles ?? [];
    return channelsOf(props.context, current).filter(
      (channel) =>
        !channel.permissionsSynced &&
        (openToEveryone(serverDefault, channel) ||
          ordered.some((role) =>
            seenByRoleOutside(
              serverDefault,
              overrides(),
              {
                everyone: pair(channel.defaultPermissions),
                roles: pairs(channel.rolePermissions),
              },
              { id: role.id, permissions: pair(role.permissions) },
            ),
          )),
    );
  });

  const roleIcon = (colour?: string | null) => (
    <RoleIcon
      style={{ background: colour || "transparent" }}
      data-empty={!colour}
    />
  );

  return (
    <Column gap="xl">
      <VisibilitySection
        server={props.context.server}
        overrides={overrides()}
        setPermissions={(target, value) =>
          props.context.server.setCategoryPermissions(
            props.context.categoryId,
            target,
            value,
          )
        }
        canEdit={props.context.server.havePermission("ManagePermissions")}
        testId="category"
        words={{
          title: <Trans>Who can see this category</Trans>,
          privateTitle: <Trans>Private category</Trans>,
          privateOn: (
            <Trans>
              Hidden from everyone except the roles you let in below. Its name
              stays visible to people who can see a channel inside it, and to
              those who manage channels or permissions or read the audit log.
            </Trans>
          ),
          privateOff: <Trans>Everyone in the server can see it.</Trans>,
          administrator: <Trans>Administrator: sees every category</Trans>,
          roleSees: <Trans>Can see this category</Trans>,
          roleHidden: <Trans>Can't see this category</Trans>,
          owner: (
            <Trans>
              The server owner and whoever manages channels or permissions see
              every category.
            </Trans>
          ),
          hideFrom: (role) => t`Hide this category from ${role}`,
          letIn: (role) => t`Let ${role} see this category`,
        }}
      />

      <Show when={stillOpen().length}>
        <SettingsSection>
          <SettingsRow
            icon={<Icon name="warning" size={20} />}
            title={
              <span data-testid="category-still-open">
                <Trans>
                  Some channels here can be seen by people outside this category
                </Trans>
              </span>
            }
            description={
              <Trans>
                They have their own permissions:{" "}
                {stillOpen()
                  .map((channel) => channel.name)
                  .join(", ")}
                . Make them follow the category in Overview.
              </Trans>
            }
            navigational
            onClick={() => navigate("overview")}
          />
        </SettingsSection>
      </Show>

      <SettingsSection
        title={<Trans>Default permissions</Trans>}
        description={
          <Trans>
            Channels that follow this category use these permissions.
          </Trans>
        }
      >
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
          when={roles().overrides.length}
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
                icon={roleIcon(role.colour)}
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
                    Grants {countBits(overrides().roles[role.id].a)} permissions
                    and denies {countBits(overrides().roles[role.id].d)}{" "}
                    permissions
                  </Trans>
                }
              />
            )}
          </For>
        </Show>
      </SettingsSection>

      <Show when={roles().withoutOverrides.length}>
        <SettingsSection title={<Trans>Roles with No Overrides</Trans>}>
          <For each={roles().withoutOverrides}>
            {(role) => (
              <SettingsRow
                icon={roleIcon(role.colour)}
                title={
                  <span style={{ color: role.colour ?? undefined }}>
                    {role.name}
                  </span>
                }
                navigational
                onClick={() => navigate(`permissions/${role.id}`)}
                description={<Trans>No permissions set yet</Trans>}
              />
            )}
          </For>
        </SettingsSection>
      </Show>
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
