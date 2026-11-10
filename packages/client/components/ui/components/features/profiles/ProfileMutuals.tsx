import { Show, createMemo, createResource } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { Server, User } from "@zrzur/sdk/solid";
import { cx } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";

import { Avatar } from "../../design";

import { ProfileSection, chip } from "./ProfileCard";
import { ProfileChipRow } from "./ProfileChipRow";
import { mutualFor } from "./mutualCache";

/**
 * Servers and friends the viewer shares with this person. The server sends
 * only what both are in, and nothing to someone blocked either way; each
 * server and friend is drawn from the viewer's own cache.
 */
export default function ProfileMutuals(props: {
  user: User;
  /** Closes the card or dialog when a chip leads somewhere else */
  onClose?: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();

  const [mutual] = createResource(
    () => props.user,
    (user) => mutualFor(user),
  );

  const servers = createMemo(() =>
    (mutual()?.servers ?? [])
      .map((id) => client().servers.get(id))
      .filter((server): server is Server => !!server),
  );
  const friends = createMemo(() =>
    (mutual()?.users ?? [])
      .map((id) => client().users.get(id))
      .filter((user): user is User => !!user),
  );

  return (
    <Show when={mutual.state === "ready" && mutual()}>
      <ProfileSection
        title={<Trans>In common</Trans>}
        label={t`Servers and friends in common`}
      >
        <Show
          when={servers().length || friends().length}
          fallback={
            <Plain data-testid="mutual-none">
              <Trans>No servers or friends in common.</Trans>
            </Plain>
          }
        >
          <Show when={servers().length}>
            <Group data-testid="mutual-servers">
              <Label>
                <Trans>Servers</Trans>
              </Label>
              <ProfileChipRow items={servers()}>
                {(server) => (
                  <button
                    type="button"
                    class={cx(chip({ press: true }))}
                    data-mutual-server={server.id}
                    onClick={() => {
                      props.onClose?.();
                      navigate(server.path);
                    }}
                  >
                    <Avatar
                      size={16}
                      src={server.iconURL}
                      fallback={server.name}
                    />
                    <span dir="auto">{server.name}</span>
                  </button>
                )}
              </ProfileChipRow>
            </Group>
          </Show>
          <Show when={friends().length}>
            <Group data-testid="mutual-friends">
              <Label>
                <Trans>Friends</Trans>
              </Label>
              <ProfileChipRow items={friends()}>
                {(friend) => (
                  <button
                    type="button"
                    class={cx(chip({ press: true }))}
                    data-mutual-friend={friend.id}
                    onClick={() =>
                      openModal({ type: "user_profile", user: friend })
                    }
                  >
                    <Avatar
                      size={16}
                      src={friend.avatarURL}
                      fallback={friend.displayName}
                    />
                    <span dir="auto">{friend.displayName}</span>
                  </button>
                )}
              </ProfileChipRow>
            </Group>
          </Show>
        </Show>
      </ProfileSection>
    </Show>
  );
}

const Group = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
});

const Label = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});

const Plain = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});
