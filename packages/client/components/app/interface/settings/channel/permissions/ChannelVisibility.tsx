import { createMemo } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";

import { VisibilityPeople } from "./VisibilityPeople";
import { VisibilitySection, pairs } from "./VisibilitySection";
import { pair } from "./visibility";

/**
 * Who can see a server channel, worked out the way the API does, with one
 * switch to make it private and one button per role to let it in or out.
 */
export function ChannelVisibility(props: { context: Channel }) {
  const { t } = useLingui();

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
        roles: pairs(synced.role_permissions),
      };
    }
    return {
      everyone: pair(props.context.defaultPermissions),
      roles: pairs(props.context.rolePermissions),
    };
  });

  return (
    <VisibilitySection
      server={props.context.server}
      overrides={overrides()}
      setPermissions={(target, value) =>
        props.context.setPermissions(target, value)
      }
      canEdit={props.context.havePermission("ManagePermissions")}
      testId="channel"
      more={(state) => (
        <VisibilityPeople
          context={props.context}
          isPrivate={state.isPrivate}
          canEdit={props.context.havePermission("ManagePermissions")}
        />
      )}
      words={{
        title: <Trans>Who can see this channel</Trans>,
        privateTitle: <Trans>Private channel</Trans>,
        privateOn: <Trans>Only the roles you let in below can see it.</Trans>,
        privateOff: <Trans>Everyone in the server can see it.</Trans>,
        administrator: <Trans>Administrator: sees every channel</Trans>,
        roleSees: <Trans>Can see this channel</Trans>,
        roleHidden: <Trans>Can't see this channel</Trans>,
        owner: <Trans>The server owner sees every channel.</Trans>,
        hideFrom: (role) => t`Hide this channel from ${role}`,
        letIn: (role) => t`Let ${role} see this channel`,
      }}
    />
  );
}
