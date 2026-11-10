import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { useModals } from "@revolt/modal";
import { Icon } from "@revolt/ui/icons/Icon";

import { SettingsConfiguration } from ".";
import { ChannelPermissionsEditor } from "./channel/permissions/ChannelPermissionsEditor";
import { JoinRequests } from "./server/JoinRequests";
import { LobbySettings } from "./server/LobbySettings";
import { ServerCard } from "./server/ServerCard";
import { WingsSettings } from "./server/WingsSettings";
import {
  canOpenServerSettings,
  canSeeMembers as canSeeMembersOf,
} from "./server/access";
import { ServerAppPage } from "./server/apps/ServerAppPage";
import { AssistantPage } from "./server/assistant/AssistantPage";
import {
  AppsPage,
  BansPage,
  ChannelsPage,
  EmojiPage,
  JoiningPage,
  LogPage,
  MembersPage,
  OverviewPage,
  RolesPage,
  SafetyPage,
  SoundboardPage,
} from "./server/pages";
import {
  type PageId,
  pageKeywords,
  resolvePage,
  sectionKeywords,
  sectionsOf,
  splitAddress,
} from "./server/registry";
import { ServerRoleEditor } from "./server/roles/ServerRoleEditor";
import { BackCard } from "./user/_AccountCard";

/**
 * Titles of the sections the settings search can jump to. The page name is
 * in the sidebar already; these are the parts inside a page.
 */
function SectionTitle(props: { id: string; page: PageId }) {
  switch (`${props.page}#${props.id}`) {
    case "overview#profile":
      return <Trans>Server profile</Trans>;
    case "overview#discovery":
      return <Trans>Discovery</Trans>;
    case "overview#invites":
      return <Trans>Invites and sharing</Trans>;
    case "overview#features":
      return <Trans>Features</Trans>;
    case "overview#danger":
      return <Trans>Danger zone</Trans>;
    case "channels#channels":
      return <Trans>Channels and categories</Trans>;
    case "joining#rules":
      return <Trans>Rules to accept</Trans>;
    case "joining#join-mode":
      return <Trans>Who can join</Trans>;
    case "joining#verification":
      return <Trans context="server-settings">Verification</Trans>;
    case "joining#questions":
      return <Trans>Welcome questions</Trans>;
    case "joining#lobby":
      return <Trans>Lobby design</Trans>;
    case "safety#emergency":
      return <Trans>Emergency</Trans>;
    case "safety#filters":
      return <Trans>Filters</Trans>;
    case "members#members":
      return <Trans>Everyone in the server</Trans>;
    case "members#invites":
      return <Trans>Active invites</Trans>;
    case "apps#bots":
      return <Trans>Bots</Trans>;
    case "apps#webhooks":
      return <Trans context="server-settings">Webhooks</Trans>;
    default:
      return null;
  }
}

/** Sections the search lists under their page (the rest are whole pages) */
const SEARCHABLE = new Set([
  "overview#profile",
  "overview#discovery",
  "overview#invites",
  "overview#features",
  "overview#danger",
  "channels#channels",
  "joining#rules",
  "joining#join-mode",
  "joining#verification",
  "joining#questions",
  "joining#lobby",
  "safety#emergency",
  "safety#filters",
  "members#members",
  "members#invites",
  "apps#bots",
  "apps#webhooks",
]);

/** Sections of a page that the search lists under it */
const searchSections = (page: PageId) =>
  sectionsOf(page)
    .filter((section) => SEARCHABLE.has(`${page}#${section.id}`))
    .map((section) => ({
      id: section.id,
      title: <SectionTitle id={section.id} page={page} />,
      keywords: sectionKeywords(section),
    }));

const Config: SettingsConfiguration<Server> = {
  resolve: resolvePage,

  /**
   * Page titles
   * @param key
   */
  title(ctx, key) {
    const { t } = useLingui();

    if (key.startsWith("roles/")) {
      if (key === "roles/default") return t`Everyone`;

      return ctx.context.roles.get(key.substring(6))?.name ?? "";
    }

    if (key === "requests" || key === "joining/requests")
      return t`Join requests`;
    if (key === "lobby" || key === "joining/lobby") return t`Lobby design`;
    if (key === "apps/assistant") return t`Zrzur Assistant`;
    if (key.startsWith("apps/bot/")) {
      const bot = useClient()().users.get(key.substring(9));
      return bot?.displayName ?? bot?.username ?? t`App`;
    }

    return ctx.entries
      .flatMap((category) => category.entries)
      .find((entry) => entry.id === splitAddress(resolvePage(key)).page)
      ?.title as string;
  },

  /**
   * Render the current server settings page
   */
  // we take care of the reactivity ourselves
  /* eslint-disable solid/components-return-once */
  render(props, server) {
    const id = splitAddress(resolvePage(props.page() ?? "")).page;

    if (!server.$exists) {
      useModals().pop();
      return null;
    }

    if (id.startsWith("apps/bot/")) {
      return <ServerAppPage server={server} appId={id.substring(9)} />;
    }

    if (id.startsWith("roles/")) {
      if (id === "roles/default") {
        return (
          <ChannelPermissionsEditor type="server_default" context={server} />
        );
      }

      return <ServerRoleEditor context={server} roleId={id.substring(6)} />;
    }

    switch (id) {
      case "overview":
        return <OverviewPage server={server} />;
      case "channels":
        return <ChannelsPage server={server} />;
      case "joining":
        return <JoiningPage server={server} />;
      case "joining/lobby":
        return <LobbySettings server={server} />;
      case "joining/requests":
        return <JoinRequests server={server} />;
      case "emoji":
        return <EmojiPage server={server} />;
      case "soundboard":
        return <SoundboardPage server={server} />;
      case "safety":
        return <SafetyPage server={server} />;
      case "log":
        return <LogPage server={server} />;
      case "members":
        return <MembersPage server={server} />;
      case "roles":
        return <RolesPage server={server} />;
      case "bans":
        return <BansPage server={server} />;
      case "apps":
        return <AppsPage server={server} />;
      case "apps/assistant":
        return <AssistantPage server={server} />;
      case "wings":
        return <WingsSettings server={server} />;
      default:
        return null;
    }
  },
  /* eslint-enable solid/components-return-once */

  /**
   * Generate list of categories / entries for server settings
   * @returns List
   */
  list(server, onClose) {
    const canSeeMembers = () => canSeeMembersOf(server);
    const manage = () => server.havePermission("ManageServer");
    // people with any settings permission see these pages; without the
    // permission to change them the page is read-only, with the reason
    const anyAccess = () => canOpenServerSettings(server);

    // five groups; one icon per page, never reused. Names that mean
    // something else elsewhere in the app carry the "server-settings"
    // context (their own translation).
    return {
      context: server,
      prepend: (
        <>
          <BackCard onClose={onClose} />
          <ServerCard server={server} />
        </>
      ),
      entries: [
        {
          hidden: !anyAccess(),
          title: <Trans>General</Trans>,
          entries: [
            {
              id: "overview",
              icon: <Icon name="identification-card" size={20} />,
              title: <Trans>Overview</Trans>,
              description: (
                <Trans>
                  How the server looks, how people find and join it, and its
                  main switches.
                </Trans>
              ),
              keywords: pageKeywords("overview"),
              sections: searchSections("overview"),
            },
            {
              id: "channels",
              icon: <Icon name="hash" size={20} />,
              title: <Trans>Channels</Trans>,
              description: <Trans>The channels and their categories.</Trans>,
              keywords: pageKeywords("channels"),
              sections: searchSections("channels"),
            },
          ],
        },
        {
          hidden: !anyAccess(),
          title: <Trans>Community</Trans>,
          entries: [
            {
              id: "joining",
              icon: <Icon name="sign-in" size={20} />,
              title: <Trans>Joining</Trans>,
              description: (
                <Trans>
                  Who can join, what they must accept, and what they see first.
                </Trans>
              ),
              keywords: pageKeywords("joining"),
              sections: searchSections("joining"),
            },
            {
              id: "emoji",
              icon: <Icon name="smiley" size={20} />,
              title: <Trans>Emoji</Trans>,
              description: <Trans>The server's own emoji.</Trans>,
              keywords: pageKeywords("emoji"),
              sections: searchSections("emoji"),
            },
            {
              id: "soundboard",
              icon: <Icon name="music-note" size={20} />,
              title: <Trans>Soundboard</Trans>,
              description: (
                <Trans>Short sounds members play in voice calls.</Trans>
              ),
              keywords: pageKeywords("soundboard"),
              sections: searchSections("soundboard"),
            },
          ],
        },
        {
          hidden: !(manage() || server.havePermission("ViewAuditLogs")),
          title: <Trans context="server-settings">Safety</Trans>,
          entries: [
            {
              id: "safety",
              hidden: !manage(),
              icon: <Icon name="shield-check" size={20} />,
              title: <Trans context="server-settings">Safety</Trans>,
              description: (
                <Trans>
                  Emergency tools, and filters against spam and unwanted links.
                </Trans>
              ),
              keywords: pageKeywords("safety"),
              sections: searchSections("safety"),
            },
            {
              id: "log",
              hidden: !server.havePermission("ViewAuditLogs"),
              icon: <Icon name="clock-counter-clockwise" size={20} />,
              title: <Trans>Audit log</Trans>,
              description: <Trans>Who changed what, and when.</Trans>,
              keywords: pageKeywords("log"),
              sections: searchSections("log"),
            },
          ],
        },
        {
          hidden: !anyAccess(),
          title: <Trans>Members</Trans>,
          entries: [
            {
              id: "members",
              hidden: !(canSeeMembers() || manage()),
              icon: <Icon name="users" size={20} />,
              title: <Trans>Members</Trans>,
              description: (
                <Trans>Everyone in the server, and its invites.</Trans>
              ),
              keywords: pageKeywords("members"),
              sections: searchSections("members"),
            },
            {
              id: "roles",
              icon: <Icon name="key" size={20} />,
              title: <Trans>Roles</Trans>,
              description: (
                <Trans>Groups of members and what they may do.</Trans>
              ),
              keywords: pageKeywords("roles"),
              sections: searchSections("roles"),
            },
            {
              id: "bans",
              hidden: !server.havePermission("BanMembers"),
              icon: <Icon name="gavel" size={20} />,
              title: <Trans>Bans</Trans>,
              description: <Trans>People who can't come back.</Trans>,
              keywords: pageKeywords("bans"),
              sections: searchSections("bans"),
            },
          ],
        },
        {
          hidden: !(
            manage() ||
            server.havePermission("KickMembers") ||
            server.havePermission("ManageWebhooks")
          ),
          title: <Trans>Apps</Trans>,
          entries: [
            {
              id: "apps",
              icon: <Icon name="robot" size={20} />,
              title: <Trans>Apps</Trans>,
              description: <Trans>Bots and webhooks.</Trans>,
              keywords: pageKeywords("apps"),
              sections: searchSections("apps"),
            },
          ],
        },
        {
          // paid items only appear where billing is on
          hidden: !(billingAvailable() && manage()),
          title: <Trans>Extras</Trans>,
          entries: [
            {
              id: "wings",
              icon: <Icon name="lightning" size={20} />,
              title: <Trans context="server-settings">Wings</Trans>,
              description: <Trans>The server's level and its perks.</Trans>,
              keywords: pageKeywords("wings"),
              sections: [],
            },
          ],
        },
      ],
    };
  },
};

export default Config;

export type ServerSettingsProps = {
  /**
   * Server
   */
  server: Server;
};
