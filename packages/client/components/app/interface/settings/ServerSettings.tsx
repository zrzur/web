import { lazy } from "@revolt/common/lib/lazyPart";
import { type JSX, Suspense } from "solid-js";

import { PageBoundary } from "@revolt/ui/components/utils/PageBoundary";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { useModals } from "@revolt/modal";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import { SettingsConfiguration } from ".";
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
  ChannelsPage,
  DiscoveryPage,
  EmojiPage,
  FeaturesPage,
  InvitesPage,
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
import { EveryoneRoleEditor } from "./server/roles/ViewAsRoleRow";
import { BackCard } from "./user/_AccountCard";

// charts and their strings load only when the page opens
const InsightsPage = lazy(() => import("./server/insights/InsightsPage"));

/**
 * Titles of the sections the settings search can jump to. The page name is
 * in the sidebar already; these are the parts inside a page.
 */
function SectionTitle(props: { id: string; page: PageId }) {
  switch (`${props.page}#${props.id}`) {
    case "overview#profile":
      return <Trans>Server profile</Trans>;
    case "overview#notifications":
      return <Trans>Default notifications</Trans>;
    case "features#features":
      return <Trans>Channels and messages</Trans>;
    case "features#threads":
      return <Trans>Threads and forums</Trans>;
    case "features#events":
      return <Trans>Events and lobby</Trans>;
    case "invites#invites":
      return <Trans>Custom invite link</Trans>;
    case "invites#invite-list":
      return <Trans>Active invites</Trans>;
    case "overview#danger":
      return <Trans>Danger zone</Trans>;
    case "joining#join-mode":
      return <Trans>Who can join</Trans>;
    case "joining#verification":
      return <Trans context="server-settings">Verification</Trans>;
    case "joining#rules":
      return <Trans>Rules to accept</Trans>;
    case "joining#on-join":
      return <Trans>When someone joins</Trans>;
    case "joining#questions":
      return <Trans>Welcome questions</Trans>;
    case "members#members":
      return <Trans>Members</Trans>;
    case "members#bans":
      return <Trans>Bans</Trans>;
    case "safety#emergency":
      return <Trans>Emergency</Trans>;
    case "safety#filters":
      return <Trans>Filters</Trans>;
    case "apps#bots":
      return <Trans>Bots</Trans>;
    case "apps#webhooks":
      return <Trans context="server-settings">Webhooks</Trans>;
    default:
      return null;
  }
}

/**
 * Sections the search lists under their page: only on pages with more
 * than one; a page with one topic is found by its own name
 */
const SEARCHABLE = new Set([
  "overview#profile",
  "overview#notifications",
  "features#features",
  "features#threads",
  "features#events",
  "invites#invites",
  "invites#invite-list",
  "overview#danger",
  "joining#join-mode",
  "joining#verification",
  "joining#rules",
  "joining#on-join",
  "joining#questions",
  "members#members",
  "members#bans",
  "safety#emergency",
  "safety#filters",
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

    if (resolvePage(key) === "joining/requests") return t`Join requests`;
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
        return <EveryoneRoleEditor server={server} />;
      }

      return <ServerRoleEditor context={server} roleId={id.substring(6)} />;
    }

    switch (id) {
      case "overview":
        return <OverviewPage server={server} />;
      case "features":
        return <FeaturesPage server={server} />;
      case "insights":
        // its own loading line while the chunk arrives, so the rest of
        // settings never waits on it
        return (
          <Suspense
            fallback={
              <p role="status" data-testid="insights-chunk-loading">
                <Trans>Loading insights…</Trans>
              </p>
            }
          >
            {/* not downloaded: a note in its place, the window stays */}
            <PageBoundary>
              <InsightsPage server={server} />
            </PageBoundary>
          </Suspense>
        );
      case "channels":
        return <ChannelsPage server={server} />;
      case "emoji":
        return <EmojiPage server={server} />;
      case "soundboard":
        return <SoundboardPage server={server} />;
      case "members":
        return <MembersPage server={server} />;
      case "roles":
        return <RolesPage server={server} />;
      case "invites":
        return <InvitesPage server={server} />;
      case "joining":
        return <JoiningPage server={server} />;
      case "joining/requests":
        return <JoinRequests server={server} />;
      case "lobby":
        return <LobbySettings server={server} />;
      case "discovery":
        return <DiscoveryPage server={server} />;
      case "safety":
        return <SafetyPage server={server} />;
      case "log":
        return <LogPage server={server} />;
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

    // Few, full pages, each one click away in the sidebar (owner,
    // 2026-11-27: a page of one block is not a page; the owner's danger
    // zone sits at the end of Overview). One icon per page, never reused. Names that mean
    // something else elsewhere in the app carry the "server-settings"
    // context (their own translation).
    const page = (
      id: PageId,
      icon: IconName,
      title: JSX.Element,
      description: JSX.Element,
      hidden = false,
    ) => ({
      id,
      hidden,
      icon: <Icon name={icon} size={20} />,
      title,
      description,
      keywords: pageKeywords(id),
      sections: searchSections(id),
    });

    return {
      context: server,
      prepend: (
        <>
          <BackCard onClose={onClose} />
          <ServerCard server={server} />
        </>
      ),
      // Grouped by what you do, as in Discord: the server itself, how it
      // looks and sounds, its people, how they get in, keeping it safe,
      // then apps and Wings. No heading over a single page.
      entries: [
        {
          hidden: !anyAccess(),
          title: <Trans context="settings-group">Server</Trans>,
          entries: [
            page(
              "overview",
              "identification-card",
              <Trans>Overview</Trans>,
              <Trans>Name, picture, description and notifications.</Trans>,
            ),
            page(
              "channels",
              "hash",
              <Trans>Channels</Trans>,
              <Trans>The channels and their categories.</Trans>,
            ),
            page(
              "features",
              "sliders-horizontal",
              <Trans>Features</Trans>,
              <Trans>System messages, threads, events and tickets.</Trans>,
            ),
            page(
              "insights",
              "waveform",
              <Trans context="server insights">Insights</Trans>,
              <Trans>Joins, messages and activity, day by day.</Trans>,
              !manage(),
            ),
          ],
        },
        {
          hidden: !anyAccess(),
          title: <Trans>Expression</Trans>,
          entries: [
            page(
              "emoji",
              "smiley",
              <Trans>Emoji</Trans>,
              <Trans>The server's own emoji.</Trans>,
            ),
            page(
              "soundboard",
              "music-note",
              <Trans>Soundboard</Trans>,
              <Trans>
                Short sounds members upload and play in voice calls.
              </Trans>,
            ),
          ],
        },
        {
          hidden: !anyAccess(),
          title: <Trans context="settings-group">People</Trans>,
          entries: [
            page(
              "members",
              "users",
              <Trans>Members</Trans>,
              <Trans>
                Search, change roles, time out, kick or ban, and see who is
                banned.
              </Trans>,
              !(
                canSeeMembers() ||
                manage() ||
                server.havePermission("BanMembers")
              ),
            ),
            page(
              "roles",
              "key",
              <Trans>Roles</Trans>,
              <Trans>Groups of members and what they may do.</Trans>,
            ),
          ],
        },
        {
          hidden: !anyAccess(),
          title: <Trans>Joining</Trans>,
          entries: [
            page(
              "invites",
              "link",
              <Trans>Invites</Trans>,
              <Trans>Your own short link, and every invite.</Trans>,
            ),
            page(
              "joining",
              "sign-in",
              <Trans>Access</Trans>,
              <Trans>
                Who can get in, what they need before they can talk, the rules
                they accept and how they are welcomed.
              </Trans>,
            ),
            page(
              "lobby",
              "house",
              <Trans context="server-settings">Lobby</Trans>,
              <Trans>What new members see first.</Trans>,
            ),
            page(
              "discovery",
              "compass",
              <Trans>Discovery</Trans>,
              <Trans>Whether people can find the server in Discover.</Trans>,
            ),
          ],
        },
        {
          hidden: !(manage() || server.havePermission("ViewAuditLogs")),
          title: <Trans context="server-settings">Safety</Trans>,
          entries: [
            page(
              "safety",
              "warning-octagon",
              <Trans>Protection</Trans>,
              <Trans>
                Pause the server during a raid, and filters that stop spam, bad
                words and unwanted links.
              </Trans>,
              !manage(),
            ),
            page(
              "log",
              "clock-counter-clockwise",
              <Trans>Audit log</Trans>,
              <Trans>Who changed what, and when.</Trans>,
              !server.havePermission("ViewAuditLogs"),
            ),
          ],
        },
        {
          hidden: !(
            manage() ||
            server.havePermission("KickMembers") ||
            server.havePermission("ManageWebhooks") ||
            (billingAvailable() && manage())
          ),
          title: <Trans context="settings-group">More</Trans>,
          entries: [
            page(
              "apps",
              "robot",
              <Trans>Apps</Trans>,
              <Trans>Bots and webhooks.</Trans>,
              !(
                manage() ||
                server.havePermission("KickMembers") ||
                server.havePermission("ManageWebhooks")
              ),
            ),
            page(
              "wings",
              "lightning",
              <Trans context="server-settings">Wings</Trans>,
              <Trans>The server's level and its perks.</Trans>,
              // paid items only appear where billing is on
              !(billingAvailable() && manage()),
            ),
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
