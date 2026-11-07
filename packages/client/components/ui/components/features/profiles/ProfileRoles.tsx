import { Show, createMemo } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { ServerMember } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { ProfileSection, chip } from "./ProfileCard";
import { ProfileChipRow } from "./ProfileChipRow";

/**
 * Server roles as small chips with their colour
 */
export function ProfileRoles(props: { member?: ServerMember }) {
  const roles = createMemo(() =>
    props.member
      ? props.member.orderedRoles
          .filter((r) =>
            props.member?.server ? props.member.server.roles.has(r.id) : true,
          )
          .toReversed()
      : [],
  );

  return (
    <Show when={roles().length}>
      <ProfileSection title={<Trans>Roles</Trans>}>
        <ProfileChipRow items={roles()}>
          {(role) => (
            <span class={chip()}>
              <Dot
                style={{
                  background: role.colour ?? "var(--z-fg-muted)",
                }}
              />
              <span dir="auto">{role.name}</span>
            </span>
          )}
        </ProfileChipRow>
      </ProfileSection>
    </Show>
  );
}

const Dot = styled("i", {
  base: {
    flexShrink: 0,
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
});
