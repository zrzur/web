import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { Server, User } from "@zrzur/sdk/solid";
import { cx } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";

import { Avatar, typography } from "../../design";

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
  /** The full profile lists them at once; the card first shows how many */
  full?: boolean;
  /** Closes the card or dialog when a chip leads somewhere else */
  onClose?: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const [opened, setOpened] = createSignal(false);
  const listed = () => props.full || opened();

  const [mutual] = createResource(
    () => props.user,
    (user) => mutualFor(user, client().user?.id ?? ""),
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
          <Show when={!listed()}>
            <Summary data-testid="mutual-summary">
              <Show when={servers().length}>
                <Stack aria-hidden="true">
                  <For each={servers().slice(0, 3)}>
                    {(server) => (
                      <Avatar
                        size={20}
                        src={server.iconURL}
                        fallback={server.name}
                        shape="rounded-square"
                      />
                    )}
                  </For>
                </Stack>
                <CountButton
                  type="button"
                  aria-expanded="false"
                  onClick={() => setOpened(true)}
                >
                  <Trans>Servers: {servers().length}</Trans>
                </CountButton>
              </Show>
              <Show when={servers().length && friends().length}>
                <span aria-hidden="true">·</span>
              </Show>
              <Show when={friends().length}>
                <CountButton
                  type="button"
                  aria-expanded="false"
                  onClick={() => setOpened(true)}
                >
                  <Trans>Friends: {friends().length}</Trans>
                </CountButton>
              </Show>
            </Summary>
          </Show>
          <Show when={listed() && servers().length}>
            <Group data-testid="mutual-servers">
              <Label>
                <Trans>Servers</Trans>
              </Label>
              <ProfileChipRow items={servers()} all={props.full}>
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
          <Show when={listed() && friends().length}>
            <Group data-testid="mutual-friends">
              <Label>
                <Trans>Friends</Trans>
              </Label>
              <ProfileChipRow items={friends()} all={props.full}>
                {(friend) => (
                  <button
                    type="button"
                    class={cx(chip({ press: true }))}
                    data-mutual-friend={friend.id}
                    onClick={() => {
                      props.onClose?.();
                      openModal({ type: "user_profile", user: friend });
                    }}
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

/** The card's one line: whose icons, and how many of each */
const Summary = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

/** Icons overlapping by a third, each cut out of the card by a ring */
const Stack = styled("span", {
  base: {
    display: "inline-flex",
    flexShrink: 0,
    paddingInlineStart: "6px",
    "& > *": {
      marginInlineStart: "-6px",
      borderRadius: "var(--z-radius-sm, 6px)",
      boxShadow: "0 0 0 2px var(--profile-ring, var(--z-bg-floating))",
    },
  },
});

const CountButton = styled("button", {
  base: {
    minHeight: "24px",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontWeight: 500,
    color: "var(--profile-ink, var(--z-fg-primary))",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
    cursor: "pointer",
    borderRadius: "var(--z-radius-xs, 4px)",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px", marginBlock: "-10px" },
  },
});

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
    ...typography.raw({ class: "label", size: "medium" }),
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});

const Plain = styled("p", {
  base: {
    margin: 0,
    ...typography.raw({ class: "body", size: "small" }),
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});
