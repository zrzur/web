import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useError } from "@revolt/i18n";
import { Dialog, DialogProps } from "@revolt/ui";
import {
  canEditRoles,
  canGiveRole,
  rolesWith,
} from "@revolt/ui/components/features/profiles/roleAccess";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

/**
 * A member's roles, as a picker: a search on top and every role of the
 * server under it, each with its colour and a box to tick. A tick gives the
 * role at once, as in any chat app; there is nothing to save. Roles you may
 * not give stay in the list, greyed, with the reason on hover.
 */
export function UserProfileRolesModal(
  props: DialogProps & Modals & { type: "user_profile_roles" },
) {
  const { t } = useLingui();
  const describeError = useError();
  const [error, setError] = createSignal<string>();
  const [query, setQuery] = createSignal("");
  /** roles on their way to the server: one tick at a time each */
  const [pending, setPending] = createSignal<string[]>([]);

  const editMode = () => canEditRoles(props.member);

  /** in edit mode every role of the server, else only the member's own */
  const roles = createMemo(() => {
    const all = editMode()
      ? (props.member.server?.orderedRoles ?? [])
      : props.member.orderedRoles.toReversed();
    const q = query().trim().toLocaleLowerCase();
    return q
      ? all.filter((role) => role.name.toLocaleLowerCase().includes(q))
      : all;
  });

  const has = (id: string) => props.member.roles.includes(id);

  async function toggle(id: string) {
    if (pending().includes(id)) return;
    setError(undefined);
    setPending((list) => [...list, id]);
    const server = props.member.server;
    try {
      await props.member.edit({
        roles: rolesWith(props.member.roles, id, !has(id), (role) =>
          server ? server.roles.has(role) : true,
        ),
      });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending((list) => list.filter((role) => role !== id));
    }
  }

  /** why a role cannot be ticked, for its tooltip */
  const lockedBecause = (role: { isManaged?: boolean }) =>
    role.isManaged ? t`A bot's own role` : t`Above your highest role`;

  return (
    <Dialog
      size="sm"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>{props.member.displayName}'s roles</Trans>}
      error={error()}
    >
      <Picker>
        <Show when={editMode()}>
          <Search>
            <Icon name="magnifying-glass" size={16} />
            <input
              type="search"
              aria-label={t`Search roles`}
              placeholder={t`Search roles`}
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              autofocus
            />
          </Search>
        </Show>

        <List role="list">
          <For
            each={roles()}
            fallback={
              <Empty>
                <Show when={query().trim()} fallback={<Trans>No roles.</Trans>}>
                  <Trans>No role matches.</Trans>
                </Show>
              </Empty>
            }
          >
            {(role) => (
              <Show
                when={editMode()}
                fallback={
                  <Item role="listitem">
                    <Dot style={{ background: role.colour ?? undefined }} />
                    <span dir="auto">{role.name}</span>
                  </Item>
                }
              >
                <ItemButton
                  type="button"
                  role="checkbox"
                  aria-checked={has(role.id)}
                  aria-disabled={!canGiveRole(props.member, role) || undefined}
                  data-busy={pending().includes(role.id) || undefined}
                  title={
                    canGiveRole(props.member, role)
                      ? undefined
                      : lockedBecause(role)
                  }
                  onClick={() => {
                    if (canGiveRole(props.member, role)) void toggle(role.id);
                  }}
                >
                  <Dot style={{ background: role.colour ?? undefined }} />
                  <span dir="auto">{role.name}</span>
                  <Show when={!canGiveRole(props.member, role)}>
                    <Icon name="lock-simple" size={14} />
                  </Show>
                  <Tick aria-hidden="true" data-on={has(role.id) || undefined}>
                    <Show when={has(role.id)}>
                      <Icon name="check" size={14} />
                    </Show>
                  </Tick>
                </ItemButton>
              </Show>
            )}
          </For>
        </List>
      </Picker>
    </Dialog>
  );
}

const Picker = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 },
});

/** the search: the shape of the app's other search fields */
const Search = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "36px",
    paddingInline: "10px",
    borderRadius: "var(--z-radius-md, 8px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-fg-muted)",
    _focusWithin: {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "-1px",
    },
    "& input": {
      flex: 1,
      minWidth: 0,
      height: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      color: "inherit",
      font: "inherit",
      fontSize: "14px",
      "&::placeholder": { color: "var(--z-fg-muted)" },
      "&::-webkit-search-cancel-button": { display: "none" },
    },
    _phone: { height: "44px" },
  },
});

const List = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxHeight: "min(56vh, 440px)",
    overflowY: "auto",
    marginInline: "-4px",
    paddingInline: "4px",
  },
});

/** one role: its colour, its name and, to change it, a box at the end */
const itemBase = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "36px",
  width: "100%",
  paddingInline: "10px",
  border: "none",
  borderRadius: "var(--z-radius-md, 8px)",
  background: "transparent",
  color: "var(--z-fg-primary)",
  font: "inherit",
  fontSize: "14px",
  fontWeight: 500,
  textAlign: "start",
  "--z-icon-color": "var(--z-fg-muted)",
  // the name takes the room; the tick box (also a span) keeps its size
  "& > span:not([aria-hidden])": {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  _phone: { minHeight: "44px" },
} as const;

const Item = styled("div", { base: itemBase });

const ItemButton = styled("button", {
  base: {
    ...itemBase,
    cursor: "pointer",
    _hover: { background: "var(--z-bg-raised)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "-2px",
    },
    "&[aria-disabled='true']": {
      cursor: "default",
      color: "var(--z-fg-muted)",
      _hover: { background: "transparent" },
    },
    "&[data-busy]": { opacity: 0.6, cursor: "progress" },
  },
});

/** the role's colour; a role without one shows the quiet grey */
const Dot = styled("i", {
  base: {
    flexShrink: 0,
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "var(--z-fg-muted)",
  },
});

/** the box at the end of a row: empty, or filled with a tick */
const Tick = styled("span", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "18px",
    height: "18px",
    borderRadius: "5px",
    border: "1.5px solid var(--z-border-strong, var(--z-fg-muted))",
    color: "var(--z-on-accent, #fff)",
    "--z-icon-color": "currentColor",
    transition:
      "background-color var(--z-motion-fast, 120ms) var(--z-ease-standard, ease)",
    "&[data-on]": {
      background: "var(--z-accent-fill, var(--z-accent))",
      borderColor: "var(--z-accent-fill, var(--z-accent))",
    },
    "[aria-disabled='true'] > &": { opacity: 0.5 },
  },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    padding: "16px 10px",
    color: "var(--z-fg-muted)",
    fontSize: "14px",
    textAlign: "center",
  },
});
