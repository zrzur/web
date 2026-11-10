import { Match, Show, Switch, createMemo } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";

import { Avatar } from "../../design";

import { ProfileSection } from "./ProfileCard";
import { creatorShown } from "./botAbout";
import { usePublicBot } from "./usePublicBot";

/**
 * Who made this bot. The owner sees their own profile (it opens on click);
 * anyone else sees the maker's name, only when the owner chose to show it
 * (`show_creator`). The owner's account id never reaches other readers.
 */
export default function ProfileOwner(props: {
  botId: string;
  bot: { owner?: string };
}) {
  const client = useClient();
  const { openModal } = useModals();
  const publicBot = usePublicBot(() => props.botId);
  const creator = createMemo(() =>
    creatorShown(publicBot(), props.bot.owner, client().user?.id),
  );

  return (
    <Show when={creator()}>
      {(creator) => (
        <ProfileSection title={<Trans>Created by</Trans>}>
          <Switch>
            <Match when={creator().kind === "self" && client().user}>
              {(self) => (
                <Owner
                  type="button"
                  onClick={() =>
                    openModal({ type: "user_profile", user: self() })
                  }
                >
                  <Avatar
                    src={self().animatedAvatarURL}
                    fallback={self().displayName}
                    size={24}
                  />
                  <span dir="auto">{self().displayName}</span>
                </Owner>
              )}
            </Match>
            <Match when={creator().kind === "name"}>
              <Maker data-testid="bot-creator">
                <Avatar
                  fallback={(creator() as { name: string }).name}
                  size={24}
                />
                <span dir="auto">{(creator() as { name: string }).name}</span>
              </Maker>
            </Match>
          </Switch>
        </ProfileSection>
      )}
    </Show>
  );
}

const Owner = styled("button", {
  base: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--profile-ink, var(--z-fg-primary))",
    cursor: "pointer",
    _hover: { "& span": { textDecoration: "underline" } },
  },
});

const Maker = styled("span", {
  base: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--profile-ink, var(--z-fg-primary))",
  },
});
