import { For, JSX, Match, Show, Suspense, Switch, lazy } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { ServerMember, User, UserProfile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { ProfileBio } from "./ProfileBio";
import { ProfileCard, ProfileSkeleton } from "./ProfileCard";
import { ProfileJoined } from "./ProfileJoined";
import { ProfileLinks } from "./ProfileLinks";
import { ProfileRoles } from "./ProfileRoles";
import { visibleSections } from "./sections";

// a bot's About, maker and commands: loaded when a bot's card first opens
const ProfileBotAbout = lazy(() => import("./ProfileBotAbout"));
const ProfileOwner = lazy(() => import("./ProfileOwner"));
const ProfileCommands = lazy(() => import("./ProfileCommands"));

// lazy: app code is loaded after the UI layer
const CommunityCreations = lazy(
  () =>
    import("@revolt/app/interface/settings/user/profile/CommunityCreations"),
);
const ProfileWearing = lazy(
  () => import("@revolt/app/interface/settings/user/profile/ProfileWearing"),
);
// lazy: asks the server only when a profile opens, never on first load
const ProfileMutuals = lazy(() => import("./ProfileMutuals"));

/**
 * Everything below the name, the same on the card and the full profile: the
 * one place profile content is drawn, so the two can never differ. The dialog
 * only gives it more width and adds Note and ID after it.
 */
export function ProfileBody(props: {
  user: User;
  member?: ServerMember;
  profile?: UserProfile;
  loading?: boolean;
  failed?: boolean;
  /** Open the long text and show more of what is listed */
  full?: boolean;
  bot?: { owner?: string };
  onClose?: () => void;
  /** More sections after these */
  children?: JSX.Element;
}) {
  return (
    <Show when={!props.loading} fallback={<ProfileSkeleton />}>
      <ProfileCard>
        <Show when={props.failed}>
          <section>
            <LoadError>
              <Trans>Couldn't load this profile.</Trans>
            </LoadError>
          </section>
        </Show>
        <ProfileSections
          user={props.user}
          member={props.member}
          profile={props.profile}
          full={props.full}
          onClose={props.onClose}
        />
        <Show when={props.bot}>
          {/* own boundaries: loading these never suspends the channel; the
              placeholder keeps Roles below from jumping while they load */}
          <Suspense fallback={<BotPlaceholder aria-hidden="true" />}>
            <ProfileBotAbout
              botId={props.user.id}
              official={props.user.officialBot}
            />
            <ProfileOwner botId={props.user.id} bot={props.bot!} />
            {/* About and Created by never wait for the commands */}
            <Suspense>
              <ProfileCommands
                botId={props.user.id}
                serverId={props.member?.id.server}
              />
            </Suspense>
          </Suspense>
        </Show>
        <ProfileRoles member={props.member} />
        <Show when={!props.user.self}>
          <ProfileMutuals user={props.user} onClose={props.onClose} />
        </Show>
        {props.children}
      </ProfileCard>
    </Show>
  );
}

const LoadError = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

/**
 * The sections a person chose, in their order. What is hidden never reaches
 * this code: the server leaves it out.
 */
export function ProfileSections(props: {
  user: User;
  member?: ServerMember;
  profile?: UserProfile;
  full?: boolean;
  /** Closes the card or dialog when a section leads somewhere else */
  onClose?: () => void;
}) {
  return (
    <For each={visibleSections(props.profile?.sections)}>
      {(section) => (
        <Switch>
          <Match when={section === "member_since"}>
            <ProfileJoined user={props.user} member={props.member} />
          </Match>
          <Match when={section === "about"}>
            <ProfileBio content={props.profile?.content} full={props.full} />
          </Match>
          <Match when={section === "links"}>
            <ProfileLinks links={props.profile?.links} />
          </Match>
          <Match when={section === "creations" && props.profile?.creator}>
            <CommunityCreations
              userId={props.user.id}
              onLeave={props.onClose}
            />
          </Match>
          <Match when={section === "wearing" && props.profile?.creator}>
            <ProfileWearing user={props.user} onLeave={props.onClose} />
          </Match>
        </Switch>
      )}
    </For>
  );
}

/** As tall as "About this bot" with two lines, while its code loads */
const BotPlaceholder = styled("div", {
  base: {
    minHeight: "96px",
  },
});
