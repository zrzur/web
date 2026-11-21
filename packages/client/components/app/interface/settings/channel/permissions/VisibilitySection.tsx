import { For, JSX, Show, createMemo, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { Server, ServerRole } from "@zrzur/sdk/solid";
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

/** The words of the section: a channel and a category say it differently */
export type VisibilityWords = {
  title: JSX.Element;
  privateTitle: JSX.Element;
  privateOn: JSX.Element;
  privateOff: JSX.Element;
  administrator: JSX.Element;
  roleSees: JSX.Element;
  roleHidden: JSX.Element;
  owner: JSX.Element;
  hideFrom: (role: string) => string;
  letIn: (role: string) => string;
};

/**
 * Who can see a server channel or a category, worked out the way the API
 * does, with one switch to make it private and one button per role to let
 * it in or out.
 */
export function VisibilitySection(props: {
  server: Server | undefined;
  /** The overrides in force */
  overrides: { everyone: Pair; roles: Record<string, Pair> };
  /** Save the override of "default" (everyone) or of a role */
  setPermissions: (
    target: string,
    value: { allow: number; deny: number },
  ) => Promise<unknown>;
  canEdit: boolean;
  words: VisibilityWords;
  /** Prefix of the test ids: "channel" or "category" */
  testId: string;
  /** Rows under the roles (a channel's people), told whether it is private */
  more?: (state: { isPrivate: boolean }) => JSX.Element;
}) {
  const describeError = useError();
  const [busy, setBusy] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  const serverDefault = () => BigInt(props.server?.defaultPermissions ?? 0);
  const asRole = (role: ServerRole) => ({
    permissions: pair(role.permissions),
    override: props.overrides.roles[role.id],
  });

  /** What a member with only this role (or no role) gets here */
  const sees = (role?: ServerRole) =>
    seesWith(serverDefault(), props.overrides.everyone, role && asRole(role));

  const isPrivate = () => !sees();
  /** Highest role first, as in the role list */
  const roles = createMemo(() => [...(props.server?.orderedRoles ?? [])]);

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
    const next = everyoneOverride(props.overrides.everyone, on);
    return run("everyone", () =>
      props.setPermissions("default", {
        allow: Number(next.a),
        deny: Number(next.d),
      }),
    );
  }

  function setRole(role: ServerRole, see: boolean) {
    const next = roleOverride(
      serverDefault(),
      props.overrides.everyone,
      asRole(role),
      see,
    );
    return run(role.id, () =>
      props.setPermissions(role.id, {
        allow: Number(next.a),
        deny: Number(next.d),
      }),
    );
  }

  return (
    <SettingsSection title={props.words.title}>
      <SettingsRow
        icon={<Icon name={isPrivate() ? "lock-simple" : "globe"} size={20} />}
        title={props.words.privateTitle}
        description={
          <>
            {isPrivate() ? props.words.privateOn : props.words.privateOff}
            {/* said aloud too: a failed save must not pass in silence */}
            <Show when={error()}>
              <ErrorLine role="alert">{error()}</ErrorLine>
            </Show>
          </>
        }
        disabled={!props.canEdit || !!busy()}
        onClick={() => void setPrivate(!isPrivate())}
        control={(ids) => (
          <Toggle
            checked={isPrivate()}
            disabled={!props.canEdit || !!busy()}
            onChange={(on) => void setPrivate(on)}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
            data-testid={`${props.testId}-private-toggle`}
          />
        )}
      />

      <For each={roles()}>
        {(role) => {
          const visible = () => sees(role);
          // an administrator sees everything; nothing here changes that
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
                admin()
                  ? props.words.administrator
                  : visible()
                    ? props.words.roleSees
                    : props.words.roleHidden
              }
              control={() => (
                <Show when={!admin()}>
                  <Button
                    data-testid={`${props.testId}-visibility-role-${role.id}`}
                    data-visible={visible()}
                    size="sm"
                    variant={visible() ? "text" : "tonal"}
                    isDisabled={!props.canEdit || !!busy()}
                    onPress={() => void setRole(role, !visible())}
                    aria-label={
                      visible()
                        ? props.words.hideFrom(role.name)
                        : props.words.letIn(role.name)
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

      {props.more?.({ isPrivate: isPrivate() })}

      <SettingsRow
        icon={<Icon name="crown" size={20} />}
        title={props.words.owner}
      />
    </SettingsSection>
  );
}

const ErrorLine = styled("span", {
  base: {
    display: "block",
    color: "var(--z-danger)",
  },
});

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

/** Stored overrides ({ a, d } numbers) as pairs */
export function pairs(
  value?: Record<string, { a: number | bigint; d: number | bigint }>,
): Record<string, Pair> {
  return Object.fromEntries(
    Object.entries(value ?? {}).map(([id, v]) => [id, pair(v)]),
  );
}
