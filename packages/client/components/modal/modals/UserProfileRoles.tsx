import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useError } from "@revolt/i18n";
import { Checkbox, Column, Dialog, DialogProps, Row } from "@revolt/ui";

import { Modals } from "../types";

export function UserProfileRolesModal(
  props: DialogProps & Modals & { type: "user_profile_roles" },
) {
  const describeError = useError();
  const [error, setError] = createSignal<string>();

  /** The API lets you change your own roles, and those of members below you */
  const editMode = () =>
    props.member.server?.owner?.self ||
    (props.member.server?.havePermission("AssignRoles") &&
      (props.member.user?.self ||
        props.member.inferiorTo(props.member.server.member!)));

  /**
   * As the API decides: a bot's role is never given by hand, and only roles
   * strictly below your own highest role (the owner may give any)
   */
  const canToggle = (role: { rank?: number; isManaged: boolean }) =>
    !role.isManaged &&
    (!!props.member.server?.owner?.self ||
      (role.rank ?? 0) > (props.member.server?.member?.ranking ?? -Infinity));

  async function toggle(roleId: string) {
    setError(undefined);
    try {
      await props.member.edit({
        roles: [
          ...props.member.roles.filter((id) => id !== roleId),
          ...(props.member.roles.includes(roleId) ? [] : [roleId]),
        ].filter((id) =>
          props.member.server ? props.member.server.roles.has(id) : true,
        ),
      });
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      minWidth={420}
      show={props.show}
      onClose={props.onClose}
      title={
        <Switch fallback={<Trans>{props.member.displayName}'s roles</Trans>}>
          <Match when={editMode()}>
            <Trans>Edit {props.member.displayName}'s roles</Trans>
          </Match>
        </Switch>
      }
      actions={[{ text: <Trans>Close</Trans> }]}
    >
      <Switch
        fallback={
          // view mode only
          <For each={props.member.orderedRoles.toReversed()}>
            {(role) => (
              <Row align>
                <RoleName>{role.name}</RoleName>
                <RoleIcon
                  style={{
                    background: role.colour ?? "var(--z-fg-muted)",
                  }}
                />
              </Row>
            )}
          </For>
        }
      >
        <Match when={editMode()}>
          <Column>
            <Show when={error()}>
              <ErrorLine role="alert">{error()}</ErrorLine>
            </Show>
            <For each={props.member.server?.orderedRoles}>
              {(role) => (
                <Checkbox
                  checked={props.member.roles.includes(role.id)}
                  disabled={!canToggle(role)}
                  onChange={() => void toggle(role.id)}
                >
                  <Row align grow>
                    <RoleName>{role.name}</RoleName>
                    <RoleIcon
                      style={{
                        background: role.colour ?? "var(--z-fg-muted)",
                      }}
                    />
                  </Row>
                </Checkbox>
              )}
            </For>
          </Column>
        </Match>
      </Switch>
    </Dialog>
  );
}

const ErrorLine = styled("span", {
  base: {
    color: "var(--z-danger)",
    fontSize: "13px",
  },
});

const RoleName = styled("span", {
  base: {
    flexGrow: 1,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

const RoleIcon = styled("div", {
  base: {
    width: "16px",
    height: "16px",
    aspectRatio: "1/1",
    borderRadius: "100%",
  },
});
