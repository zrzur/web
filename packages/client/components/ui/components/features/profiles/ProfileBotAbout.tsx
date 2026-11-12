import { Show } from "solid-js";

import { Plural, Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import { ProfileSection } from "./ProfileCard";
import { usePublicBot } from "./usePublicBot";

/** Only ordinary web addresses become links */
export const safeLink = (url?: string) =>
  url && /^https?:\/\//i.test(url) ? url : undefined;

/**
 * About a bot, from its public page: whether Zrzur verified it, how many
 * servers it is in, and its privacy policy and terms. Nothing is shown for a
 * private bot the reader cannot see.
 */
export default function ProfileBotAbout(props: { botId: string }) {
  const bot = usePublicBot(() => props.botId);

  const privacy = () => safeLink(bot()?.privacyPolicyUrl);
  const terms = () => safeLink(bot()?.termsOfServiceUrl);

  return (
    <Show
      when={bot()}
      fallback={
        // the space it will take, so Roles below do not jump
        <Show when={bot.loading()}>
          <Waiting aria-hidden="true" />
        </Show>
      }
    >
      {(bot) => (
        <ProfileSection title={<Trans>About this bot</Trans>}>
          <Facts data-testid="bot-about">
            <li data-verified={bot().verified}>
              <Icon name={bot().verified ? "seal-check" : "info"} size={16} />
              <Show
                when={bot().verified}
                fallback={<Trans>Not verified by Zrzur</Trans>}
              >
                <Trans>Verified by Zrzur</Trans>
              </Show>
            </li>
            <Show when={bot().serverCount !== undefined}>
              <li>
                <Icon name="users-three" size={16} />
                <Plural
                  value={bot().serverCount!}
                  _0="Not in any servers yet"
                  one="In # server"
                  other="In # servers"
                />
              </li>
            </Show>
          </Facts>
          <Show when={privacy() || terms()}>
            <Links>
              <Show when={privacy()}>
                <a href={privacy()} target="_blank" rel="noopener noreferrer">
                  <Trans>Privacy policy</Trans>
                </a>
              </Show>
              <Show when={terms()}>
                <a href={terms()} target="_blank" rel="noopener noreferrer">
                  <Trans>Terms of service</Trans>
                </a>
              </Show>
            </Links>
          </Show>
        </ProfileSection>
      )}
    </Show>
  );
}

const Facts = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--profile-ink-2, var(--z-fg-secondary))",
    },
    "& li[data-verified='true']": {
      "--z-icon-color": "var(--z-status-success)",
      color: "var(--profile-ink, var(--z-fg-primary))",
    },
  },
});

const Links = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 16px",
    fontSize: "13px",
    lineHeight: "20px",
    "& a": {
      color: "var(--z-link)",
      textDecoration: "none",
    },
    "& a:hover": { textDecoration: "underline" },
    "& a:focus-visible": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
      borderRadius: "4px",
    },
  },
});

/** As tall as About with two lines, while the bot's page loads */
const Waiting = styled("div", {
  base: { minHeight: "96px" },
});
