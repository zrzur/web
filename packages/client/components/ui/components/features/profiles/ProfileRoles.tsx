import { Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { ServerMember } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";
import { Icon } from "@revolt/ui/icons/Icon";

import { ProfileSection, chip } from "./ProfileCard";
import { ProfileChipRow } from "./ProfileChipRow";
import { canEditRoles, canGiveRole, rolesWith } from "./roleAccess";

/**
 * Server roles as small chips with their colour. Someone who may change
 * them takes a role off with the x on its chip and gives one with the +
 * at the end of the row, which opens the role picker.
 */
export function ProfileRoles(props: {
  member?: ServerMember;
  /** The full profile names the server and shows every role */
  full?: boolean;
}) {
  const { t } = useLingui();
  const { openModal } = useModals();
  const [busy, setBusy] = createSignal<string>();

  const roles = createMemo(() =>
    props.member
      ? props.member.orderedRoles
          .filter((r) =>
            props.member?.server ? props.member.server.roles.has(r.id) : true,
          )
          .toReversed()
      : [],
  );

  const editable = () => canEditRoles(props.member);

  async function remove(id: string) {
    const member = props.member;
    if (!member || busy()) return;
    setBusy(id);
    try {
      await member.edit({
        roles: rolesWith(member.roles, id, false, (role) =>
          member.server ? member.server.roles.has(role) : true,
        ),
      });
    } catch {
      // the chip stays: the role was not taken
    } finally {
      setBusy(undefined);
    }
  }

  const openPicker = () =>
    props.member &&
    openModal({ type: "user_profile_roles", member: props.member });

  return (
    <Show when={roles().length || editable()}>
      <ProfileSection
        title={
          <Show
            when={props.full && props.member?.server}
            fallback={<Trans>Roles</Trans>}
          >
            <Trans>Roles in {props.member!.server!.name}</Trans>
          </Show>
        }
      >
        <ProfileChipRow
          items={roles()}
          all={props.full}
          trailing={
            editable() ? (
              <button
                type="button"
                class={chip({ press: true })}
                aria-label={t`Add role`}
                title={t`Add role`}
                onClick={openPicker}
              >
                <Icon name="plus" size={14} />
              </button>
            ) : undefined
          }
        >
          {(role) => (
            <span
              class={chip()}
              data-mention-role={role.id}
              data-busy={busy() === role.id || undefined}
            >
              <Show
                when={editable() && canGiveRole(props.member, role)}
                fallback={
                  <Dot
                    style={{ background: role.colour ?? "var(--z-fg-muted)" }}
                  />
                }
              >
                {/* the colour turns into an x under the pointer, as a
                    chat app's role chips do */}
                <Remove
                  type="button"
                  aria-label={t`Remove ${role.name}`}
                  title={t`Remove ${role.name}`}
                  style={{ "--role": role.colour ?? "var(--z-fg-muted)" }}
                  onClick={() => void remove(role.id)}
                >
                  <Icon name="x" size={10} />
                </Remove>
              </Show>
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

/** the role's colour dot, which becomes the way to take the role off */
const Remove = styled("button", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "12px",
    height: "12px",
    padding: 0,
    border: "none",
    borderRadius: "50%",
    background: "var(--role)",
    color: "transparent",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    "& svg": { opacity: 0 },
    // the chip under the pointer, or the dot in focus: an x on the colour
    "span:hover > &": {
      color: "var(--z-bg-base, #000)",
      "& svg": { opacity: 1 },
    },
    "&:focus-visible": {
      color: "var(--z-bg-base, #000)",
      "& svg": { opacity: 1 },
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "1px",
    },
    "[data-busy] > &": { opacity: 0.5, cursor: "progress" },
  },
});
