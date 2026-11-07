import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { ServerAccess as AccessMode, Server } from "@zrzur/sdk/solid";

import { useError } from "@revolt/i18n";
import {
  Button,
  Column,
  Dialog,
  SettingsChoices,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";
import { useSaved } from "./savedNotice";
import { membersCanInvite, opensAccess, withMemberInvites } from "./privacy";

/**
 * Who can join and how. Every choice here is what the backend enforces
 * (see ./privacy.ts); nothing is cosmetic.
 */
export function ServerAccess(props: { server: Server }) {
  const { t } = useLingui();
  const describeError = useError();
  const { navigate } = useSettingsNavigation();

  const saved = useSaved();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  // a change that lets more people in waits for a confirmation
  const [confirm, setConfirm] = createSignal<AccessMode>();

  const canManage = () => props.server.havePermission("ManageServer");
  const canInvite = () => membersCanInvite(props.server.defaultPermissions);

  async function apply(next: AccessMode) {
    if (pending() || next === props.server.access) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.setAccess(next);
      saved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  function choose(next: AccessMode) {
    if (!canManage() || next === props.server.access) return;
    if (opensAccess(props.server.access, next)) setConfirm(next);
    else void apply(next);
  }

  async function setInvites(allowed: boolean) {
    if (pending() || allowed === canInvite()) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.setPermissions(
        "default",
        Number(withMemberInvites(props.server.defaultPermissions, allowed)),
      );
      saved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Column gap="xl">
      <SettingsChoices<AccessMode>
        label={<Trans>How people join</Trans>}
        value={props.server.access}
        disabled={!canManage() || pending()}
        onChange={choose}
        options={[
          {
            value: "Open",
            title: t`Public`,
            description: t`Anyone with an invite joins right away.`,
          },
          {
            value: "Approval",
            title: t`Private`,
            description: t`People ask to join, and someone you allow lets them in.`,
          },
          {
            value: "Locked",
            title: t`Locked`,
            description: t`Only invites from people allowed to invite. No requests.`,
          },
        ]}
      />

      <SettingsSection title={<Trans>Invites</Trans>}>
        <SettingsRow
          icon={<Icon name="user-plus" size={20} />}
          title={<Trans>Members can invite</Trans>}
          description={
            <Show
              when={canInvite()}
              fallback={
                <Trans>Only roles with Invite others can share invites.</Trans>
              }
            >
              <Trans>Every member can share an invite link.</Trans>
            </Show>
          }
          onClick={
            props.server.havePermission("ManagePermissions") && !pending()
              ? () => setInvites(!canInvite())
              : undefined
          }
          control={(ids) => (
            <Toggle
              checked={canInvite()}
              disabled={
                pending() || !props.server.havePermission("ManagePermissions")
              }
              onChange={() => setInvites(!canInvite())}
              aria-labelledby={ids.labelId}
            />
          )}
        />
        <Show
          when={
            props.server.access === "Approval" &&
            props.server.havePermission("ManageJoinRequests")
          }
        >
          <SettingsRow
            navigational
            icon={<Icon name="tray" size={20} />}
            title={<Trans>Join requests</Trans>}
            description={<Trans>Review who asked to join.</Trans>}
            onClick={() => navigate("joining/requests")}
          />
        </Show>
        <SettingsRow
          icon={<Icon name="compass" size={20} />}
          title={<Trans context="server-settings">Discover</Trans>}
          description={
            <Show
              when={props.server.access === "Open"}
              fallback={<Trans>Only public servers can be listed.</Trans>}
            >
              <Show
                when={props.server.discoverable}
                fallback={<Trans>Not listed.</Trans>}
              >
                <Trans>Listed on Discover.</Trans>
              </Show>
            </Show>
          }
          control={() => (
            <Show when={canManage() && props.server.access === "Open"}>
              <Button
                size="sm"
                variant="tonal"
                onPress={() => navigate("overview#discovery")}
              >
                <Trans>Open</Trans>
              </Button>
            </Show>
          )}
        />
        <Show when={error()}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            title={<span role="alert">{error()}</span>}
          />
        </Show>
      </SettingsSection>

      <Show when={confirm()}>
        <Dialog
          show
          tone="warning"
          size="sm"
          onClose={() => setConfirm(undefined)}
          title={<Trans>Let more people in?</Trans>}
          actions={[
            { text: <Trans>Cancel</Trans> },
            {
              text: <Trans>Change access</Trans>,
              onClick: () => apply(confirm()!),
            },
          ]}
        >
          <Show
            when={confirm() === "Open"}
            fallback={
              <Trans>
                People with a join link can send requests again, including the
                custom link.
              </Trans>
            }
          >
            <Trans>
              Anyone with a join link will join right away, without approval.
              Requests that are still waiting stay in Join requests.
            </Trans>
          </Show>
        </Dialog>
      </Show>
    </Column>
  );
}
