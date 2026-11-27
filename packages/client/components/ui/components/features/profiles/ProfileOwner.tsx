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
 * Who made this bot, with their picture; their profile opens on click. The
 * owner always sees themselves here; anyone else only when the owner chose
 * to be shown (`show_creator`).
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
            <Match when={creator().kind === "name" && creator()}>
              {(maker) => {
                const shown = maker() as {
                  name: string;
                  avatar?: string;
                  id?: string;
                };
                const face = (
                  <>
                    <Avatar
                      src={shown.avatar}
                      fallback={shown.name}
                      size={24}
                    />
                    <span dir="auto">{shown.name}</span>
                  </>
                );
                // with their id (the owner chose to be shown) their profile
                // opens; an older server sends the name alone
                return (
                  <Show
                    when={shown.id}
                    fallback={<Maker data-testid="bot-creator">{face}</Maker>}
                  >
                    {(id) => (
                      <Owner
                        type="button"
                        data-testid="bot-creator"
                        onClick={() =>
                          void client()
                            .users.fetch(id())
                            .then((user) =>
                              openModal({ type: "user_profile", user }),
                            )
                            .catch(() => undefined)
                        }
                      >
                        {face}
                      </Owner>
                    )}
                  </Show>
                );
              }}
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
