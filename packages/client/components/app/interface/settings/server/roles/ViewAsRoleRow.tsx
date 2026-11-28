import { Trans } from "@lingui/solid/macro";
import { Server, viewServerAs } from "@zrzur/sdk/solid";

import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { Button, Column, SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { ChannelPermissionsEditor } from "../../channel/permissions/ChannelPermissionsEditor";

/**
 * "View server as this role" (as in Discord): closes settings and shows the
 * server as members with only these roles see it. No roles is @everyone.
 */
export function ViewAsRoleRow(props: { server: Server; roleIds: string[] }) {
  const { pop } = useModals();
  const navigate = useNavigate();

  const view = () => {
    viewServerAs(props.server.id, props.roleIds);
    pop();
    navigate(`/server/${props.server.id}`);
  };

  return (
    <SettingsRow
      icon={<Icon name="eye" size={20} />}
      title={<Trans>View server as this role</Trans>}
      description={
        <Trans>
          See the channels and actions members with this role have. Only your
          view changes.
        </Trans>
      }
      control={() => (
        <Button size="sm" variant="tonal" shape="square" onPress={view}>
          <Icon name="eye" size={16} />
          <Trans>View as role</Trans>
        </Button>
      )}
    />
  );
}

/** The @everyone page: its permissions, and viewing the server as it */
export function EveryoneRoleEditor(props: { server: Server }) {
  return (
    <Column gap="xl">
      <ChannelPermissionsEditor type="server_default" context={props.server} />
      <SettingsSection title={<Trans>Manage</Trans>}>
        <ViewAsRoleRow server={props.server} roleIds={[]} />
      </SettingsSection>
    </Column>
  );
}
