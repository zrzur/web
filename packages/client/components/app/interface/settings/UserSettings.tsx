import { Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";

import { useClient, useClientLifecycle } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import {
  SOURCE_CODE_URL,
  THIRD_PARTY_NOTICES_URL,
  serverBuildOf,
  shortCommit,
} from "@revolt/common/lib/buildInfo";
import { STAFF_TOOLS_ENABLED } from "@revolt/common/lib/staffTools";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { fetchLatestChangelog } from "@revolt/modal/modals/changelogFeed";
import { pluginsEnabled } from "@revolt/plugins/enabled";
import { useNavigate } from "@revolt/routing";
import { ColouredText, Column, Text, iconSize } from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { BotIcon } from "@revolt/ui/icons/BotIcon";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  account_circle as MdAccountCircle,
  campaign as MdCampaign,
  description as MdDescription,
  download as MdDownload,
  keyboard as MdKeybinds,
  language as MdLanguage,
  logout as MdLogout,
  memory as MdMemory,
  mic as MdMic,
  notifications as MdNotifications,
  palette as MdPalette,
  rate_review as MdRateReview,
  science as MdScience,
  shield as MdShield,
  verified_user as MdVerifiedUser,
} from "@revolt/ui/icons/legacy";

import pkg from "../../../../../../package.json";

import { SettingsConfiguration } from ".";
import { SettingsTabs } from "./SettingsTabs";
import { AccountCard, BackCard } from "./user/_AccountCard";
import { MyAccount } from "./user/Account";
import AdvancedSettings from "./user/Advanced";
import { AppearanceMenu } from "./user/appearance";
import { MyBadges } from "./user/badges/MyBadges";
import { Feedback } from "./user/Feedback";
import { KeybindsSettings } from "./user/Keybinds";
import { LanguageSettings } from "./user/Language";
import { MyData } from "./user/myData/MyData";
import Native from "./user/Native";
import Notifications from "./user/notifications/Notifications";
import { PluginsPage } from "./user/plugins";
import { EditProfile } from "./user/profile";
import {
  ReportsAndStanding,
  SafetyReviewPage,
  safetyAccess,
} from "./user/safety";
import { Sessions } from "./user/Sessions";
import { PlusPage, Subscriptions } from "./user/subscriptions";
import { ContactSupport } from "./user/support/ContactSupport";
import { VoiceSettings } from "./user/voice/VoiceSettings";

const Config: SettingsConfiguration<{ server: Server }> = {
  /**
   * Page titles
   * @param key
   */
  title(ctx, key) {
    // reached from Advanced, not listed in the sidebar
    if (key === "plugins") return (<Trans>Plugins</Trans>) as unknown as string;

    return ctx.entries
      .flatMap((category) => category.entries)
      .find((entry) => entry.id === key)?.title as string;
  },

  /**
   * Render the current client settings page
   */
  // we take care of the reactivity ourselves
  /* eslint-disable solid/reactivity */
  /* eslint-disable solid/components-return-once */
  render(props) {
    const id = props.page();
    const { t } = useLingui();

    switch (id) {
      case "account":
        return <MyAccount />;
      case "appearance":
        return <AppearanceMenu />;
      case "advanced":
        return <AdvancedSettings />;
      case "plugins":
        // a saved or typed path to this page leads to Advanced while plugins are off
        return pluginsEnabled(useClient()()) ? (
          <PluginsPage />
        ) : (
          <AdvancedSettings />
        );
      case "profile":
      case "badges":
        return (
          <SettingsTabs
            label={t`Profile`}
            initial={id}
            tabs={[
              {
                id: "profile",
                label: <Trans>Profile</Trans>,
                render: () => <EditProfile />,
              },
              {
                id: "badges",
                label: <Trans>Badges</Trans>,
                render: () => <MyBadges />,
              },
            ]}
          />
        );
      case "sessions":
        return <Sessions />;
      case "my-data":
        return <MyData />;
      case "language":
        return <LanguageSettings />;
      case "feedback":
      case "reports":
        return (
          <SettingsTabs
            label={t`Feedback & reports`}
            initial={id}
            tabs={[
              {
                id: "feedback",
                label: <Trans>Feedback</Trans>,
                render: () => <Feedback />,
              },
              {
                id: "reports",
                label: <Trans>Reports & standing</Trans>,
                render: () => <ReportsAndStanding />,
              },
            ]}
          />
        );
      case "safety":
        // an old link to the page shows nothing while staff tools are hidden
        return STAFF_TOOLS_ENABLED ? <SafetyReviewPage /> : null;
      case "support":
        return <ContactSupport />;
      case "plus":
      case "subscriptions":
        return billingAvailable() ? (
          <SettingsTabs
            label={t`Zrzur Feather`}
            initial={id}
            tabs={[
              {
                id: "plus",
                label: <Trans>Feather</Trans>,
                render: () => <PlusPage />,
              },
              {
                id: "subscriptions",
                label: <Trans>Your subscriptions</Trans>,
                render: () => <Subscriptions />,
              },
            ]}
          />
        ) : null;
      case "native":
        return <Native />;
      case "voice":
        return <VoiceSettings />;
      case "keybinds":
        return <KeybindsSettings />;
      case "notifications":
        return <Notifications isDesktop={!!window.native} />;
      default:
        return null;
    }
  },
  /* eslint-enable solid/reactivity */
  /* eslint-enable solid/components-return-once */

  /**
   * Generate list of categories / entries for client settings
   * @returns List
   */
  list(_, onClose) {
    const { pop, openModal } = useModals();
    const navigate = useNavigate();
    const { logout } = useClientLifecycle();
    const client = useClient();
    // the server reports the commit it was built from (additive field)
    const serverBuild = () => serverBuildOf(client()?.configuration);
    const { limits, config } = useInstance();

    return {
      context: null!,
      prepend: (
        <Column gap="s">
          <BackCard onClose={onClose} />
          <AccountCard />
          <div />
        </Column>
      ),
      append: (
        <Column gap="none">
          <Text class="label">
            <span class={css({ userSelect: "none", fontWeight: "bold" })}>
              <Trans>Zrzur</Trans> <Trans>Version:</Trans>
            </span>{" "}
            <bdi
              dir="ltr"
              class={css({ userSelect: "all", unicodeBidi: "isolate" })}
            >
              <span data-testid="web-version">{pkg.version}</span>
              <Show when={shortCommit()}> ({shortCommit()})</Show>
            </bdi>
          </Text>
          <Show when={serverBuild()}>
            {(build) => (
              <Text class="label">
                <span class={css({ userSelect: "none", fontWeight: "bold" })}>
                  <Trans>Server</Trans> <Trans>Version:</Trans>
                </span>{" "}
                <a
                  href={build().sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="server-source-link"
                >
                  <bdi dir="ltr" class={css({ unicodeBidi: "isolate" })}>
                    {build().version}
                    <Show when={build().commit}>
                      {" "}
                      ({build().commit.slice(0, 7)})
                    </Show>
                  </bdi>
                </a>
              </Text>
            )}
          </Show>
          <Show when={window.native}>
            <Text class="label">
              <Trans>Zrzur for Desktop</Trans>{" "}
              <bdi dir="ltr">{window.native.versions.desktop()}</bdi>
            </Text>
            <Text class="label">
              <span
                class={css({
                  fontSize: "0.8em",
                  lineHeight: "0.8em",
                  opacity: "0.5",
                })}
              >
                {window.native.versions.electron()},{" "}
                {window.native.versions.node()},{" "}
                {window.native.versions.chrome()}
              </span>
            </Text>
          </Show>
          <Show when={config.features.legal_links}>
            {(links) => (
              <Text class="label">
                <span
                  class={css({
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5em",
                    opacity: "0.5",
                    "& a": {
                      color: "inherit",
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    },
                  })}
                >
                  <Show when={links().terms_of_service}>
                    <a
                      href={links().terms_of_service}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Trans>Terms</Trans>
                    </a>
                  </Show>
                  <Show when={links().privacy_policy}>
                    <a
                      href={links().privacy_policy}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Trans>Privacy</Trans>
                    </a>
                  </Show>
                  <Show when={links().guidelines}>
                    <a
                      href={links().guidelines}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Trans>Guidelines</Trans>
                    </a>
                  </Show>
                </span>
              </Text>
            )}
          </Show>
        </Column>
      ),
      entries: [
        {
          title: <Trans>User settings</Trans>,
          entries: [
            {
              id: "account",
              icon: <></>,
              // hidden from the list (the account card links here) but used as the page heading
              title: <Trans>My account</Trans>,
              hidden: true,
            },
            {
              id: "profile",
              icon: <MdAccountCircle {...iconSize(20)} />,
              title: <Trans>Profile</Trans>,
            },
            {
              // a tab of Profile
              id: "badges",
              icon: <></>,
              title: <Trans>Profile</Trans>,
              hidden: true,
            },
            {
              id: "sessions",
              icon: <MdVerifiedUser {...iconSize(20)} />,
              title: <Trans>Sessions</Trans>,
            },
            {
              // apps you let act for you through OAuth2; revoked there
              icon: <Icon name="key" size={20} />,
              title: <Trans>Authorised apps</Trans>,
              onClick() {
                pop();
                navigate("/oauth2/authorized");
              },
            },
            {
              id: "my-data",
              icon: <MdDownload {...iconSize(20)} />,
              title: <Trans>My data</Trans>,
            },
          ],
        },
        {
          // one job per section: subscriptions, building, help
          title: <Trans>Subscriptions</Trans>,
          // only when the server offers Feather (test mode included)
          hidden: !billingAvailable(),
          entries: [
            {
              id: "plus",
              hidden: !billingAvailable(),
              icon: <BadgeMark id="plus" />,
              title: <Trans>Zrzur Feather</Trans>,
            },
            {
              // a tab of Zrzur Feather
              id: "subscriptions",
              icon: <></>,
              title: <Trans>Zrzur Feather</Trans>,
              hidden: true,
            },
          ],
        },
        {
          title: <Trans>Developers</Trans>,
          entries: [
            {
              // bots are managed in one place: the Developer Portal
              icon: <BotIcon size={20} />,
              title: <Trans>Developer Portal</Trans>,
              onClick() {
                pop();
                navigate("/developers");
              },
            },
          ],
        },
        {
          title: <Trans>Help & safety</Trans>,
          entries: [
            {
              id: "support",
              icon: <Symbol size={20}>headset_mic</Symbol>,
              title: <Trans>Contact support</Trans>,
            },
            {
              id: "feedback",
              icon: <MdRateReview {...iconSize(20)} />,
              title: <Trans>Feedback & reports</Trans>,
            },
            {
              // a tab of Feedback & reports
              id: "reports",
              icon: <></>,
              title: <Trans>Feedback & reports</Trans>,
              hidden: true,
            },
            {
              id: "safety",
              icon: <MdShield {...iconSize(20)} />,
              title: <Trans>Trust & Safety</Trans>,
              // reviewers only (the API checks every request); hidden with
              // the other staff tools for now
              hidden:
                !STAFF_TOOLS_ENABLED || !safetyAccess(useClient()())?.review,
            },
          ],
        },
        {
          title: <Trans>Client settings</Trans>,
          entries: [
            // {
            //   id: "audio",
            //   icon: <MdSpeaker {...iconSize(20)} />,
            //   title: t("app.settings.pages.audio.title"),
            //   hidden:
            //     !getController("state").experiments.isEnabled("voice_chat"),
            // },
            {
              id: "voice",
              icon: <MdMic {...iconSize(20)} />,
              title: limits().video ? (
                <Trans>Voice & Video</Trans>
              ) : (
                <Trans>Voice</Trans>
              ),
            },
            {
              id: "appearance",
              icon: <MdPalette {...iconSize(20)} />,
              title: <Trans>Appearance</Trans>,
            },
            // {
            //   id: "accessibility",
            //   icon: <MdAccessibility {...iconSize(20)} />,
            //   title: t("app.settings.pages.accessibility.title"),
            // },
            // {
            //   id: "plugins",
            //   icon: <MdExtension {...iconSize(20)} />,
            //   title: t("app.settings.pages.plugins.title"),
            //   hidden: !getController("state").experiments.isEnabled("plugins"),
            // },
            {
              id: "notifications",
              icon: <MdNotifications {...iconSize(20)} />,
              title: <Trans>Notifications</Trans>,
            },
            {
              id: "keybinds",
              icon: <MdKeybinds {...iconSize(20)} />,
              title: <Trans>Keyboard shortcuts</Trans>,
            },
            {
              id: "language",
              icon: <MdLanguage {...iconSize(20)} />,
              title: <Trans>Language</Trans>,
            },
            // {
            //   id: "sync",
            //   icon: <MdSync {...iconSize(20)} />,
            //   title: t("app.settings.pages.sync.title"),
            // },
            {
              id: "native",
              hidden: !window.native,
              icon: <Symbol size={20}>desktop_windows</Symbol>,
              title: <Trans>Desktop</Trans>,
            },
            // {
            //   id: "experiments",
            //   icon: <MdScience {...iconSize(20)} />,
            //   title: <Trans>Experiments</Trans>,
            // },
          ],
        },
        {
          entries: [
            {
              onClick: async () => {
                const changelog = await fetchLatestChangelog();
                if (!changelog) return;
                openModal({ type: "changelog", changelog });
              },
              icon: <MdCampaign {...iconSize(20)} />,
              title: <Trans>What's New</Trans>,
            },
            {
              href: SOURCE_CODE_URL,
              icon: <MdMemory {...iconSize(20)} />,
              title: <Trans>Source code</Trans>,
            },
            {
              href: THIRD_PARTY_NOTICES_URL,
              icon: <MdDescription {...iconSize(20)} />,
              title: <Trans>Third-party notices</Trans>,
            },
            {
              id: "advanced",
              icon: <MdScience {...iconSize(20)} />,
              title: <Trans>Advanced</Trans>,
            },
            {
              id: "logout",
              icon: (
                <MdLogout {...iconSize(20)} fill="var(--md-sys-color-error)" />
              ),
              title: (
                <ColouredText colour="var(--md-sys-color-error)">
                  <Trans>Log out</Trans>
                </ColouredText>
              ),
              onClick() {
                pop();
                logout();
              },
            },
          ],
        },
      ],
    };
  },
};

export default Config;
