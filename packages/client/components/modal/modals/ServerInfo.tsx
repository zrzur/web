import { For, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useTime } from "@revolt/i18n";
import { Markdown } from "@revolt/markdown";
import {
  Avatar,
  Column,
  Dialog,
  DialogProps,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";

import { ServerStatusBadges } from "@revolt/ui/components/features/profiles/ServerStatusBadges";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

export function ServerInfoModal(
  props: DialogProps & Modals & { type: "server_info" },
) {
  const client = useClient();
  const { openModal } = useModals();
  const dayjs = useTime();
  const visibleChannels = () =>
    props.server.channels.filter((channel) =>
      channel.havePermission("ViewChannel"),
    );

  const canOpenSettings = () =>
    props.server.orPermission(
      "ManageServer",
      "ManageCustomisation",
      "ManageRole",
      "ManagePermissions",
    );

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      size="md"
      title={<Trans>Server information</Trans>}
      actions={[
        ...(canOpenSettings()
          ? [
              {
                text: <Trans>Settings</Trans>,
                onClick() {
                  openModal({
                    type: "settings",
                    config: "server",
                    context: props.server,
                  });
                },
              },
            ]
          : []),
        ...(props.server.member
          ? [
              {
                text: <Trans>Edit identity</Trans>,
                onClick() {
                  openModal({
                    type: "server_identity",
                    member: props.server.member!,
                  });
                },
              },
            ]
          : []),
        {
          text: <Trans>Report</Trans>,
          variant: "warning",
          onClick() {
            openModal({
              type: "report_content",
              client: client(),
              target: props.server,
            });
          },
        },
        { text: <Trans>Close</Trans> },
      ]}
    >
      <Column gap="lg">
        <Identity>
          <Show when={props.server.bannerURL}>
            <Banner src={props.server.bannerURL} alt="" />
          </Show>
          <IdentityBody>
            <Avatar
              size={48}
              shape="rounded-square"
              src={props.server.animatedIconURL}
              fallback={props.server.name}
            />
            <Names>
              <div
                style={{
                  display: "flex",
                  "align-items": "start",
                  gap: "12px",
                  "justify-content": "space-between",
                }}
              >
                <Name dir="auto">{props.server.name}</Name>
                <ServerStatusBadges flags={props.server.flags} mode="press" />
              </div>
              <Muted>
                <Trans>Created</Trans> ·{" "}
                {dayjs(props.server.createdAt).format("LL")}
              </Muted>
            </Names>
          </IdentityBody>
        </Identity>

        <SettingsSection title={<Trans>About</Trans>}>
          <Description>
            <Show
              when={props.server.description?.trim()}
              fallback={
                <Muted>
                  <Trans>No description provided.</Trans>
                </Muted>
              }
            >
              <Markdown content={props.server.description!} />
            </Show>
          </Description>
        </SettingsSection>

        <SettingsSection title={<Trans>Server details</Trans>}>
          <SettingsRow
            icon={<Icon name="users" size={20} />}
            title={<Trans>Members (approximate)</Trans>}
            control={() => (
              <Value>{props.server.approximateMemberCount ?? "—"}</Value>
            )}
          />
          <SettingsRow
            icon={<Icon name="list-bullets" size={20} />}
            title={<Trans>Channels visible to you</Trans>}
            control={() => <Value>{visibleChannels().length}</Value>}
          />
          <SettingsRow
            icon={<Icon name="shield-check" size={20} />}
            title={<Trans>Roles</Trans>}
            control={() => <Value>{props.server.roles.size}</Value>}
          />
          <SettingsRow
            icon={<Icon name="users" size={20} />}
            title={<Trans>Server owner</Trans>}
            description={
              props.server.owner?.displayName ??
              props.server.owner?.username ??
              props.server.ownerId
            }
          />
          <SettingsRow
            icon={<Icon name="identification-card" size={20} />}
            title={<Trans>Server ID</Trans>}
            description={<code>{props.server.id}</code>}
          />
          <Show when={props.server.mature}>
            <SettingsRow
              icon={<Icon name="info" size={20} />}
              title={<Trans>Age-restricted server</Trans>}
            />
          </Show>
        </SettingsSection>

        <Show when={props.server.orderedRoles.length}>
          <SettingsSection title={<Trans>Roles</Trans>}>
            <Roles>
              <For each={props.server.orderedRoles}>
                {(role) => (
                  <Role>
                    <Dot
                      style={{ background: role.colour || "var(--z-fg-muted)" }}
                    />
                    <span dir="auto">{role.name}</span>
                  </Role>
                )}
              </For>
            </Roles>
          </SettingsSection>
        </Show>
      </Column>
    </Dialog>
  );
}

const Identity = styled("div", {
  base: {
    overflow: "hidden",
    borderRadius: "14px",
    // the shared dialog card surface; the server icon fallback sits on its
    // own tile one step up
    background: "var(--z-card-bg)",
    "--md-sys-color-surface-container-low": "var(--z-float-tile)",
    border: "1px solid var(--z-border-subtle)",
  },
});
const Banner = styled("img", {
  base: {
    display: "block",
    width: "100%",
    height: "auto",
    // a strip, not a poster: the details stay in view
    aspectRatio: "3 / 1",
    objectFit: "cover",
  },
});
const IdentityBody = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px",
    minWidth: 0,
  },
});
const Names = styled("div", {
  base: {
    minWidth: 0,
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
});
const Name = styled("div", {
  base: {
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.3,
    overflowWrap: "anywhere",
    color: "var(--z-fg-primary)",
  },
});
const Muted = styled("span", {
  base: { fontSize: "13px", color: "var(--z-fg-muted)" },
});
const Value = styled("span", {
  base: {
    fontSize: "15px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
});
const Description = styled("div", {
  base: {
    padding: "12px 14px",
    overflowWrap: "anywhere",
    userSelect: "text",
    minWidth: 0,
  },
});
const Roles = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "6px", padding: "12px" },
});
const Role = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 8px",
    borderRadius: "8px",
    border: "1px solid var(--z-border-subtle)",
    fontSize: "13px",
    maxWidth: "100%",
    overflowWrap: "anywhere",
  },
});
const Dot = styled("span", {
  base: { width: "8px", height: "8px", flexShrink: 0, borderRadius: "50%" },
});
