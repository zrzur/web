import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";

import { CONFIGURATION } from "@revolt/common";
import { SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";
import { Discoverable } from "../shared/Discoverable";

import { useClient } from "@revolt/client";
import { applicationsOpen } from "../user/badges/programsApi";
import { AutoModSettings } from "./AutoModSettings";
import { EventsLobbySwitches } from "./EventsLobbySwitches";
import { OnJoinSettings } from "./OnJoinSettings";
import Overview, { type ProfileDraft } from "./Overview";
import { RulesScreening } from "./RulesScreening";
import { ServerAccess } from "./ServerAccess";
import { ServerBots } from "./ServerApps";
import { ServerDefaultNotifications } from "./ServerDefaultNotifications";
import { ServerEmergency } from "./ServerEmergency";
import { ServerOwnership } from "./ServerOwnership";
import { ServerPreview } from "./ServerPreview";
import { ServerVerification } from "./ServerVerification";
import { ThreadFeatures } from "./ThreadFeatures";
import { TicketsSettings } from "./TicketsSettings";
import { VerifiedServerApplication } from "./VerifiedServerApplication";
import { canSeeMembers } from "./access";
import { AuditLog } from "./audit/AuditLog";
import { ListServerBans } from "./bans/ListBans";
import { ChannelExtras } from "./channels/ChannelExtras";
import { ChannelsSettings } from "./channels/ChannelsSettings";
import { EmojiList } from "./emojis/EmojiList";
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
import { RoleQuestions } from "./roles/RoleQuestions";
import { ServerRoleOverview } from "./roles/ServerRoleOverview";
import { SoundboardList } from "./soundboard/SoundboardList";
import { showsVerifiedServer } from "./verifiedServer";
import { ServerWebhooks } from "./webhooks/ServerWebhooks";

const isOwner = (server: Server) => !!server.owner?.self;

/**
 * Overview: the server's profile, what members are notified about, and for
 * the owner, giving the server away or deleting it
 */
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
        >
          <Overview server={props.server} onDraft={setDraft} />
        </Anchor>

        <Anchor
          id="notifications"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Default notifications</Trans>}
          description={
            <Trans>
              What members are notified about until they choose for themselves.
            </Trans>
          }
        >
          <ServerDefaultNotifications server={props.server} />
        </Anchor>

        {/* the owner's own, at the end of the page (it was a page of one
            block: owner, 2026-11-27 "fewer, fuller pages") */}
        <Show when={isOwner(props.server)}>
          <Anchor id="danger" title={<Trans>Danger zone</Trans>}>
            <ServerOwnership server={props.server} />
          </Anchor>
        </Show>
      </PageWithAside>
    </PageSave>
  );
}

/** Features: the rules channel and system messages, threads, events, tickets */
export function FeaturesPage(props: { server: Server }) {
  return (
    <PageSave>
      <PageStack>
        <Anchor id="features" needs={missing(props.server, "ManageServer")}>
          <ChannelExtras server={props.server} />
        </Anchor>

        <Anchor
          id="threads"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Threads and forums</Trans>}
        >
          <ThreadFeatures server={props.server} />
        </Anchor>

        <Anchor
          id="events"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Events and lobby</Trans>}
        >
          <EventsLobbySwitches server={props.server} />
        </Anchor>

        <Anchor
          id="tickets"
          needs={missing(props.server, "ManageServer")}
          title={<Trans context="server-settings">Tickets</Trans>}
        >
          <TicketsSettings server={props.server} />
        </Anchor>
      </PageStack>
    </PageSave>
  );
}

/** Discovery: being listed in Discover, and the Verified Server check */
export function DiscoveryPage(props: { server: Server }) {
  const client = useClient();
  return (
    <PageStack>
      <Anchor id="discovery">
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

      <Show
        when={showsVerifiedServer(props.server, applicationsOpen(client()))}
      >
        <Anchor
          id="verified-server"
          title={<Trans>Verified Server</Trans>}
          description={
            <Trans>
              The Zrzur team's check that this is the official server of a real
              game, company, creator or project.
            </Trans>
          }
        >
          <VerifiedServerApplication server={props.server} />
        </Anchor>
      </Show>
    </PageStack>
  );
}

/** Invites: the server's own short link and every invite there is */
export function InvitesPage(props: { server: Server }) {
  return (
    <PageSave>
      <PageStack>
        <Anchor id="invites" needs={missing(props.server, "ManageServer")}>
          <VanityInvite server={props.server} />
        </Anchor>
        <Show when={props.server.havePermission("ManageServer")}>
          <Anchor id="invite-list">
            <ListServerInvites server={props.server} />
          </Anchor>
        </Show>
      </PageStack>
    </PageSave>
  );
}

/** Channels and categories */
export function ChannelsPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor id="channels" needs={missing(props.server, "ManageChannel")}>
        <ChannelsSettings server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/**
 * Joining: who can get in, what they need before they can talk, the rules
 * they accept, and the roles, welcome and questions they get. One page
 * from the door to the first message (owner, 2026-11-27: fewer, fuller
 * pages).
 */
export function JoiningPage(props: { server: Server }) {
  return (
    <PageSave>
      <PageStack>
        <Anchor
          id="join-mode"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Who can join</Trans>}
        >
          <ServerAccess server={props.server} />
        </Anchor>

        <Anchor
          id="verification"
          needs={missing(props.server, "ManageServer")}
          title={<Trans context="server-settings">Verification</Trans>}
          description={
            <Trans>What new members need before they can talk.</Trans>
          }
        >
          <ServerVerification server={props.server} />
        </Anchor>

        <Anchor
          id="rules"
          needs={missing(props.server, "ManageServer")}
          title={<Trans>Rules to accept</Trans>}
        >
          <RulesScreening server={props.server} />
        </Anchor>

        <Anchor
          id="on-join"
          needs={
            props.server.havePermission("ManageRole")
              ? undefined
              : missing(props.server, "ManageServer")
          }
          title={<Trans>When someone joins</Trans>}
        >
          <OnJoinSettings server={props.server} />
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
      </PageStack>
    </PageSave>
  );
}

/** Emoji: the server's own emoji */
export function EmojiPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor id="emoji" needs={missing(props.server, "ManageCustomisation")}>
        <EmojiList server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Soundboard: the short sounds the server's people upload */
export function SoundboardPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor id="soundboard" needs={missing(props.server, "ManageSoundboard")}>
        <SoundboardList server={props.server} />
      </Anchor>
    </PageStack>
  );
}

/** Safety: pause the server during a raid, and filters for spam and words */
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

/** Members: everyone in the server, and the people banned from it */
export function MembersPage(props: { server: Server }) {
  return (
    <PageStack>
      <Show when={canSeeMembers(props.server)}>
        <Anchor id="members">
          <ListServerMembers server={props.server} />
        </Anchor>
      </Show>
      <Show when={props.server.havePermission("BanMembers")}>
        <Anchor id="bans">
          <ListServerBans server={props.server} />
        </Anchor>
      </Show>
    </PageStack>
  );
}

/** Roles */
export function RolesPage(props: { server: Server }) {
  return (
    <PageStack>
      <Anchor
        id="roles"
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
            <Trans>
              The official bot: safety, community and support in one place.
            </Trans>
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
        <Anchor id="bots" title={<Trans>Bots</Trans>}>
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
