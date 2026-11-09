import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel, ServerRole } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useError } from "@revolt/i18n";
import { Button, SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { isAdministrator } from "./dangerous";
import {
  type Pair,
  everyoneOverride,
  pair,
  roleOverride,
  sees as seesWith,
} from "./visibility";

/**
 * Who can see a server channel, worked out the way the API does, with one
 * switch to make it private and one button per role to let it in or out.
 */
export function ChannelVisibility(props: { context: Channel }) {
  const { t } = useLingui();
  const describeError = useError();
  const [busy, setBusy] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  /** The overrides in force: the category's while the channel follows it */
  const overrides = createMemo(() => {
    const synced = props.context.syncedCategory as
      | {
          default_permissions?: { a: number; d: number };
          role_permissions?: Record<string, { a: number; d: number }>;
        }
      | undefined;
    if (synced) {
      return {
        everyone: pair(synced.default_permissions),
        roles: Object.fromEntries(
          Object.entries(synced.role_permissions ?? {}).map(([id, v]) => [
            id,
            pair(v),
          ]),
        ) as Record<string, Pair>,
      };
    }
    return {
      everyone: pair(props.context.defaultPermissions),
      roles: Object.fromEntries(
        Object.entries(props.context.rolePermissions ?? {}).map(([id, v]) => [
          id,
          pair(v),
        ]),
      ) as Record<string, Pair>,
    };
  });

  const serverDefault = () =>
    BigInt(props.context.server?.defaultPermissions ?? 0);
  const asRole = (role: ServerRole) => ({
    permissions: pair(role.permissions),
    override: overrides().roles[role.id],
  });

  /** What a member with only this role (or no role) gets here */
  const sees = (role?: ServerRole) =>
    seesWith(serverDefault(), overrides().everyone, role && asRole(role));

  const isPrivate = () => !sees();
  /** Highest role first, as in the role list */
  const roles = createMemo(() => [
    ...(props.context.server?.orderedRoles ?? []),
  ]);
  const canEdit = () => props.context.havePermission("ManagePermissions");

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(undefined);
    }
  }

  function setPrivate(on: boolean) {
    const next = everyoneOverride(overrides().everyone, on);
    return run("everyone", () =>
      props.context.setPermissions("default", {
        allow: Number(next.a),
        deny: Number(next.d),
      }),
    );
  }

  function setRole(role: ServerRole, see: boolean) {
    const next = roleOverride(
      serverDefault(),
      overrides().everyone,
      asRole(role),
      see,
    );
    return run(role.id, () =>
      props.context.setPermissions(role.id, {
        allow: Number(next.a),
        deny: Number(next.d),
      }),
    );
  }

  return (
    <SettingsSection title={<Trans>Who can see this channel</Trans>}>
      <SettingsRow
        icon={<Icon name={isPrivate() ? "lock-simple" : "globe"} size={20} />}
        title={<Trans>Private channel</Trans>}
        description={
          error() ??
          (isPrivate() ? (
            <Trans>Only the roles you let in below can see it.</Trans>
          ) : (
            <Trans>Everyone in the server can see it.</Trans>
          ))
        }
        disabled={!canEdit() || !!busy()}
        onClick={() => void setPrivate(!isPrivate())}
        control={(ids) => (
          <Toggle
            checked={isPrivate()}
            disabled={!canEdit() || !!busy()}
            onChange={(on) => void setPrivate(on)}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
            data-testid="channel-private-toggle"
          />
        )}
      />

      <For each={roles()}>
        {(role) => {
          const visible = () => sees(role);
          // an administrator sees every channel; nothing here changes that
          const admin = () => isAdministrator(pair(role.permissions).a);
          return (
            <SettingsRow
              icon={
                <Dot
                  style={{ background: role.colour || "transparent" }}
                  data-empty={!role.colour}
                />
              }
              title={
                <span style={{ color: role.colour ?? undefined }}>
                  {role.name}
                </span>
              }
              description={
                admin() ? (
                  <Trans>Administrator: sees every channel</Trans>
                ) : visible() ? (
                  <Trans>Can see this channel</Trans>
                ) : (
                  <Trans>Can't see this channel</Trans>
                )
              }
              control={() => (
                <Show when={!admin()}>
                  <Button
                    data-testid={`channel-visibility-role-${role.id}`}
                    data-visible={visible()}
                    size="sm"
                    variant={visible() ? "text" : "tonal"}
                    isDisabled={!canEdit() || !!busy()}
                    onPress={() => void setRole(role, !visible())}
                    aria-label={
                      visible()
                        ? t`Hide this channel from ${role.name}`
                        : t`Let ${role.name} see this channel`
                    }
                  >
                    <Show when={visible()} fallback={<Trans>Let in</Trans>}>
                      <Trans>Hide</Trans>
                    </Show>
                  </Button>
                </Show>
              )}
            />
          );
        }}
      </For>

      <SettingsRow
        icon={<Icon name="crown" size={20} />}
        title={<Trans>The server owner sees every channel.</Trans>}
      />
    </SettingsSection>
  );
}

const Dot = styled("span", {
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
