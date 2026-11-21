import { Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

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

  /** Said aloud after a change, from a live region outside the panel (a
   *  span inside it would break the hairline between its rows) */
  const [said, setSpoken] = createSignal("");
  // the same words twice are read out twice
  const say = (text: string) => {
    setSpoken("");
    queueMicrotask(() => setSpoken(text));
  };

  return (
    <Show
      when={!props.context.parentId}
      fallback={
        // a thread reads every override from its channel: nothing to set here
        <SettingsSection title={<Trans>Who can see this channel</Trans>}>
          <SettingsRow
            data-testid="channel-visibility-thread"
            icon={<Icon name="link" size={20} />}
            title={
              <Show
                when={props.context.parent?.name}
                fallback={
                  <Trans>This thread follows who can see its channel.</Trans>
                }
              >
                {(name) => (
                  <Trans>This thread follows who can see #{name()}.</Trans>
                )}
              </Show>
            }
          />
        </SettingsSection>
      }
    >
      <>
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
              onSay={say}
            />
          )}
          words={{
            title: <Trans>Who can see this channel</Trans>,
            privateTitle: <Trans>Private channel</Trans>,
            privateOn: (
              <Trans>Only the roles you let in below can see it.</Trans>
            ),
            privateOff: <Trans>Everyone in the server can see it.</Trans>,
            administrator: <Trans>Administrator: sees every channel</Trans>,
            roleSees: <Trans>Can see this channel</Trans>,
            roleHidden: <Trans>Can't see this channel</Trans>,
            owner: <Trans>The server owner sees every channel.</Trans>,
            hideFrom: (role) => t`Hide this channel from ${role}`,
            letIn: (role) => t`Let ${role} see this channel`,
          }}
        />
        <LiveRegion aria-live="polite" data-testid="channel-people-said">
          {said()}
        </LiveRegion>
      </>
    </Show>
  );
}

/** Read out, not shown */
const LiveRegion = styled("span", {
  base: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
});
