import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";

import { CONFIGURATION } from "@revolt/common";
import { SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";
import { Discoverable } from "../shared/Discoverable";

import Overview, { type ProfileDraft } from "./Overview";
import { AutoModSettings } from "./AutoModSettings";
import { EventsLobbySwitches } from "./EventsLobbySwitches";
import { ServerBots } from "./ServerApps";
import { ServerWebhooks } from "./webhooks/ServerWebhooks";
import { ServerAccess } from "./ServerAccess";
import { ServerDefaultNotifications } from "./ServerDefaultNotifications";
import { ServerEmergency } from "./ServerEmergency";
import { ServerOwnership } from "./ServerOwnership";
import { ServerPreview } from "./ServerPreview";
import { ServerVerification } from "./ServerVerification";
import { ThreadFeatures } from "./ThreadFeatures";
import { ListServerBans } from "./bans/ListBans";
import { AuditLog } from "./audit/AuditLog";
import { ChannelExtras } from "./channels/ChannelExtras";
import { ChannelsSettings } from "./channels/ChannelsSettings";
import { EmojiList } from "./emojis/EmojiList";
import { SoundboardList } from "./soundboard/SoundboardList";
import { ListServerInvites } from "./invites/ListServerInvites";
import { VanityInvite } from "./invites/VanityInvite";
import {
  Anchor,
  PageStack,
  PageWithAside,
  ReadOnlyNote,
  missing,
} from "./layout";
import { ListServerMembers } from "./members/ListMembers";
import { PageSave } from "./pageSave";
import { RulesScreening } from "./RulesScreening";
import { RoleQuestions } from "./roles/RoleQuestions";
import { ServerRoleOverview } from "./roles/ServerRoleOverview";
import { canSeeMembers } from "./access";

const isOwner = (server: Server) => !!server.owner?.self;

/** Overview: profile, discovery, invites, features, danger zone */
export function OverviewPage(props: { server: Server }) {
  const [draft, setDraft] = createSignal<ProfileDraft>();

  return (
    <PageSave>
      <PageWithAside
        aside={<ServerPreview server={props.server} draft={draft()} />}
      >
        <Anchor
          id="profile"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Server profile</Trans>}
          description={<Trans>The name, picture and description people see.</Trans>}
        >
          <Overview server={props.server} onDraft={setDraft} />
        </Anchor>

        <Anchor
          id="discovery"
          title={<Trans>Discovery</Trans>}
          description={<Trans>Whether people can find the server in Discover.</Trans>}
        >
          <Show
            when={isOwner(props.server)}
            fallback={
              <ReadOnlyNote role="note">
                <Trans>
                  Only the owner of the server can change how it appears in
                  Discover.
                </Trans>
              </ReadOnlyNote>
            }
          >
            <Discoverable discoverable={props.server} fullPage={true} />
          </Show>
        </Anchor>

        <Anchor
          id="invites"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Invites and sharing</Trans>}
          description={<Trans>A short link people remember.</Trans>}
        >
          <VanityInvite server={props.server} />
        </Anchor>

        <Anchor
          id="features"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Features</Trans>}
          description={
            <Trans>The rules channel, system messages and counters.</Trans>
          }
        >
          <ChannelExtras server={props.server} />
        </Anchor>

        <Anchor
          id="threads"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Threads and forums</Trans>}
          description={<Trans>Turn them on or off for this server.</Trans>}
        >
          <ThreadFeatures server={props.server} />
        </Anchor>

        <Anchor
          id="events"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Events and lobby</Trans>}
          description={
            <Trans>Rows at the top of the channel list. Both start off.</Trans>
          }
        >
          <EventsLobbySwitches server={props.server} />
        </Anchor>

        <Anchor
          id="notifications"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Default notifications</Trans>}
          description={
            <Trans>
              What members are notified about until they choose for
              themselves.
            </Trans>
          }
        >
          <ServerDefaultNotifications server={props.server} />
        </Anchor>

        <Show when={isOwner(props.server)}>
          <Anchor
            id="danger"
            title={<Trans>Danger zone</Trans>}
            description={
              <Trans>Give the server to someone else, or delete it.</Trans>
            }
          >
            <ServerOwnership server={props.server} />
          </Anchor>
        </Show>
      </PageWithAside>
    </PageSave>
  );
}

/** Channels and categories */
export function ChannelsPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor
        id="channels"
          needs={missing(props.server, "ManageChannel")}
      >
        <ChannelsSettings server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Joining and onboarding */
export function JoiningPage(props: { server: Server }) {
  const { navigate } = useSettingsNavigation();

  return (
    <PageSave>
      <PageStack>
        <Anchor
          id="join-mode"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Who can join</Trans>}
          description={<Trans>How people get in, and who may invite them.</Trans>}
        >
          <ServerAccess server={props.server} />
        </Anchor>

        <Anchor
          id="verification"
          needs={missing(props.server, "ManageServer")}
          title={<Trans context="server-settings">Verification</Trans>}
          description={<Trans>What new members need before they can talk.</Trans>}
        >
          <ServerVerification server={props.server} />
        </Anchor>

        <Anchor
          id="rules"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Rules to accept</Trans>}
          description={<Trans>New members agree to the rules before they write.</Trans>}
        >
          <RulesScreening server={props.server} />
        </Anchor>

        <Anchor
          id="questions"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Welcome questions</Trans>}
          description={
            <Trans>Let new members pick their interests and get roles.</Trans>
          }
        >
          <RoleQuestions server={props.server} />
        </Anchor>

        <Anchor
          id="lobby"
          needs={missing(props.server, "ManageServer")}
          title={<Trans context="server-settings">Lobby</Trans>}
          description={<Trans>What new members see first.</Trans>}
        >
          <SettingsSection>
            <SettingsRow
              navigational
              icon={<Icon name="house" size={20} />}
              title={<Trans>Lobby design</Trans>}
              description={
                <Trans>
                  Colours, layout, welcome text, buttons and questions of the
                  lobby.
                </Trans>
              }
              onClick={() => navigate("joining/lobby")}
            />
          </SettingsSection>
        </Anchor>
      </PageStack>
    </PageSave>
  );
}

/** Emoji */
export function EmojiPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor
        id="emoji"
          needs={missing(props.server, "ManageCustomisation")}
      >
        <EmojiList server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Soundboard */
export function SoundboardPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor id="soundboard" needs={missing(props.server, "ManageSoundboard")}>
        <SoundboardList server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Safety: emergency tools and filters */
export function SafetyPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor
        id="emergency"
        title={<Trans>Emergency</Trans>}
        description={<Trans>Pause invites or messages during a raid.</Trans>}
      >
        <ServerEmergency server={props.server} />
      </Anchor>
      <Anchor
        id="filters"
        title={<Trans>Filters</Trans>}
        description={
          <Trans>Rules that stop spam, bad words and unwanted links.</Trans>
        }
      >
        <AutoModSettings server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Audit log */
export function LogPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor id="log">
        <AuditLog server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Members and the list of active invites */
export function MembersPage(props: { server: Server }) {
  return (
    <PageStack>
      <Show when={canSeeMembers(props.server)}>
        <Anchor
          id="members"
          title={<Trans>Everyone in the server</Trans>}
          description={<Trans>Search, change roles, time out, kick or ban.</Trans>}
        >
          <ListServerMembers server={props.server} />
        </Anchor>
      </Show>
      <Show when={props.server.havePermission("ManageServer")}>
        <Anchor
          id="invites"
        >
          <ListServerInvites server={props.server} />
        </Anchor>
      </Show>
    </PageStack>
  );
}

/** Roles */
export function RolesPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor id="roles"
          needs={
          props.server.havePermission("ManagePermissions")
            ? undefined
            : missing(props.server, "ManageRole")
        }
      >
        <ServerRoleOverview context={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Bans */
export function BansPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor id="bans">
        <ListServerBans server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Apps: bots and webhooks */
export function AppsPage(props: { server: Server }) {
  const { navigate } = useSettingsNavigation();
  return (
    <PageStack>
      <Show
        when={
          CONFIGURATION.ASSISTANT && props.server.havePermission("ManageServer")
        }
      >
        <Anchor
          id="assistant"
          title={<Trans>Zrzur Assistant</Trans>}
          description={
            <Trans>The official bot: safety, community and support in one place.</Trans>
          }
        >
          <SettingsSection>
            <SettingsRow
              icon={<Icon name="robot" size={20} />}
              title={<Trans>Zrzur Assistant</Trans>}
              description={<Trans>Choose modules and set them up.</Trans>}
              navigational
              onClick={() => navigate("apps/assistant")}
            />
          </SettingsSection>
        </Anchor>
      </Show>
      <Show
        when={
          props.server.havePermission("ManageServer") ||
          props.server.havePermission("KickMembers")
        }
      >
        <Anchor
          id="bots"
          title={<Trans>Bots</Trans>}
          description={<Trans>The bots in this server.</Trans>}
        >
          <ServerBots server={props.server} />
        </Anchor>
      </Show>
      <Show when={props.server.havePermission("ManageWebhooks")}>
        <Anchor
          id="webhooks"
          needs={missing(props.server, "ManageWebhooks")}
          title={<Trans context="server-settings">Webhooks</Trans>}
          description={<Trans>Links that let other services post.</Trans>}
        >
          <ServerWebhooks server={props.server} />
        </Anchor>
      </Show>
    </PageStack>
  );
}
