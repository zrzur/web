import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";
import { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";
import {
  Avatar,
  Button,
  Column,
  Draggable,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { createDragHandle } from "@revolt/ui/components/utils/Draggable";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../../Settings";
import {
  dismissNotice,
  everyoneCanMasquerade,
  noticeDismissed,
  withoutMasquerade,
} from "./masqueradeNotice";

/**
 * Menu to see all roles
 */
export function ServerRoleOverview(props: { context: Server }) {
  const { navigate } = useSettingsNavigation();
  const { t } = useLingui();
  const { openModal, showError } = useModals();

  const change = useMutation(() => ({
    mutationFn: (order: string[]) => props.context.setRoleOrdering(order),
    onError: showError,
  }));

  // servers from before Zrzur may let everyone post under another name
  // bumped when the notice is closed, so it is read again
  const [closed, setClosed] = createSignal(0);
  const dismissed = () => closed() >= 0 && noticeDismissed(props.context.id);
  const showMasqueradeNotice = () =>
    !dismissed() &&
    props.context.havePermission("ManageRole") &&
    everyoneCanMasquerade(props.context.defaultPermissions);

  const turnOffMasquerade = useMutation(() => ({
    mutationFn: () =>
      props.context.setPermissions(
        "default",
        withoutMasquerade(props.context.defaultPermissions),
      ),
    onError: showError,
  }));

  function closeNotice() {
    dismissNotice(props.context.id);
    setClosed((n) => n + 1);
  }

  // roles at or above your highest role can't be moved or edited by you
  // (the server refuses it too); the owner can do everything
  const locked = (rank: number) =>
    rank <= (props.context.member?.ranking ?? Infinity);

  function createRole() {
    openModal({
      type: "create_role",
      server: props.context,
      callback(roleId) {
        navigate(`roles/${roleId}`);
      },
    });
  }

  return (
    <Column gap="xl">
      <SettingsSection
        title={<Trans>Order</Trans>}
        description={
          <Show
            when={change.isPending}
            fallback={
              <Trans>
                Drag to reorder. Roles higher in the list rank above lower ones.
              </Trans>
            }
          >
            <Trans>Saving the new order…</Trans>
          </Show>
        }
        aside={
          <Button size="sm" shape="square" onPress={createRole}>
            <Icon name="plus" size={16} />
            <Trans>Create role</Trans>
          </Button>
        }
      >
        <Show
          when={props.context.orderedRoles.length}
          fallback={
            <SettingsRow
              icon={<Icon name="shield-check" size={20} />}
              title={<Trans>No roles yet</Trans>}
              description={
                <Trans>
                  Roles group members and give them permissions and a colour.
                </Trans>
              }
            />
          }
        >
          <Draggable
            dragHandles
            items={props.context.orderedRoles}
            onChange={change.mutate}
          >
            {(entry) => (
              <SettingsRow
                icon={
                  <RoleMarker>
                    <Show
                      when={!locked(entry.item.rank)}
                      fallback={
                        <Handle data-locked="">
                          <Icon name="lock-simple" size={16} />
                        </Handle>
                      }
                    >
                      <Handle
                        {...createDragHandle(
                          entry.dragDisabled,
                          entry.setDragDisabled,
                        )}
                        aria-label={t`Drag to reorder ${entry.item.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon name="dots-six-vertical" size={16} />
                      </Handle>
                    </Show>
                    <Dot
                      style={{
                        background: entry.item.colour || "transparent",
                      }}
                      data-empty={!entry.item.colour}
                    />
                  </RoleMarker>
                }
                title={
                  <TitleLine>
                    <span style={{ color: entry.item.colour ?? undefined }}>
                      {entry.item.name}
                    </span>
                    <Show when={entry.item.icon}>
                      <Avatar
                        shape="rounded-square"
                        src={entry.item.icon!.previewUrl}
                        size={20}
                      />
                    </Show>
                  </TitleLine>
                }
                description={
                  locked(entry.item.rank)
                    ? t`At or above your highest role: only someone higher can change it.`
                    : undefined
                }
                onClick={
                  locked(entry.item.rank)
                    ? undefined
                    : () => navigate(`roles/${entry.item.id}`)
                }
                navigational={!locked(entry.item.rank)}
              />
            )}
          </Draggable>
        </Show>
      </SettingsSection>

      <SettingsSection title={<Trans>Default permissions</Trans>}>
        <Show when={showMasqueradeNotice()}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            title={<Trans>Everyone can post under another name</Trans>}
            description={
              <Trans>
                Members can send messages with any name and picture, for example
                “Admin”. Turn this off unless your server needs it; you can
                still give it to a role.
              </Trans>
            }
            control={() => (
              <NoticeActions>
                <Button
                  size="sm"
                  variant="text"
                  onPress={closeNotice}
                  isDisabled={turnOffMasquerade.isPending}
                >
                  <Trans>Keep it</Trans>
                </Button>
                <Button
                  size="sm"
                  onPress={() => turnOffMasquerade.mutate()}
                  isDisabled={turnOffMasquerade.isPending}
                >
                  <Trans>Turn off</Trans>
                </Button>
              </NoticeActions>
            )}
          />
        </Show>
        <SettingsRow
          icon={<Icon name="users" size={20} />}
          title={<Trans>Everyone</Trans>}
          description={
            <Trans>What every member can do before any role is added.</Trans>
          }
          onClick={() => navigate("roles/default")}
          navigational
        />
      </SettingsSection>
    </Column>
  );
}

const RoleMarker = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
});

const Handle = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    // the same handle as in profile settings: a 24 px target (44 px on
    // phones) with a focus ring; the drawn grip stays 16 px
    flexShrink: 0,
    width: "24px",
    height: "24px",
    // the target grows around the grip without moving the row's content
    margin: "-4px",
    borderRadius: "6px",
    cursor: "grab",
    "--z-icon-color": "var(--z-icon-muted)",
    _hover: { "--z-icon-color": "var(--z-icon-hover)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[data-locked]": { cursor: "default" },
    "@media (max-width: 600px)": {
      width: "44px",
      height: "44px",
      margin: "-14px",
    },
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

const TitleLine = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
});

const NoticeActions = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
});
