import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";

import { Avatar } from "../../design";

import { ProfileSection } from "./ProfileCard";

/**
 * Who made this bot; opens the owner's profile
 */
export function ProfileOwner(props: { bot: { owner: string } }) {
  const client = useClient();
  const { openModal } = useModals();

  const query = useQuery(() => ({
    queryKey: ["owner", props.bot.owner],
    queryFn: async () => {
      const clnt = client();
      return (
        clnt.users.get(props.bot.owner) ??
        (await clnt.users.fetch(props.bot.owner))
      );
    },
  }));

  return (
    <Show when={props.bot.owner && query.data}>
      <ProfileSection title={<Trans>Created by</Trans>}>
        <Owner
          type="button"
          onClick={() => openModal({ type: "user_profile", user: query.data! })}
        >
          <Avatar
            src={query.data!.animatedAvatarURL}
            fallback={query.data!.displayName}
            size={24}
          />
          <span dir="auto">{query.data!.displayName}</span>
        </Owner>
      </ProfileSection>
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
