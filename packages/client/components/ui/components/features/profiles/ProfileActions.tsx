import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { ServerMember, User } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { UserContextMenu } from "@revolt/app";
import { useModals } from "@revolt/modal";
import { Icon } from "@revolt/ui/icons/Icon";

import { Button } from "../../design";

import { usePublicBot } from "./ProfileBotAbout";

interface Props {
  user: User;
  member?: ServerMember;
  onClose: () => void;
}

/**
 * Whether the current user may edit this profile (own profile, or a
 * server identity they have permission to change)
 */
function canEdit(props: Props) {
  if (!props.member) return props.user.self;
  const server = props.member.server!;
  return props.user.self
    ? server.havePermission("ChangeNickname") ||
        server.havePermission("ChangeAvatar")
    : (server.havePermission("ManageNicknames") ||
        server.havePermission("RemoveAvatars")) &&
        props.member.inferiorTo(server.member!);
}

function useProfileActions(props: Props) {
  const navigate = useNavigate();
  const { openModal, showError } = useModals();

  // shared with the rest of the card through the SDK's cache: one request
  const publicBot = usePublicBot(() =>
    props.user.bot ? props.user.id : undefined,
  );

  return {
    publicBot,
    openDm() {
      props.user
        .openDM()
        .then((channel) => navigate(channel.path))
        .catch(showError);
      props.onClose();
    },
    openEdit() {
      openModal(
        props.member
          ? { type: "server_identity", member: props.member }
          : { type: "settings", config: "user", context: { page: "profile" } },
      );
      props.onClose();
    },
    addBot() {
      openModal({ type: "add_bot", invite: publicBot()! });
    },
    run(action: () => Promise<unknown>) {
      action().catch(showError);
    },
  };
}

/**
 * Small controls over the banner corner: add friend, edit, more
 */
export function ProfileCornerActions(props: Props) {
  const { t } = useLingui();
  const actions = useProfileActions(props);

  return (
    <>
      <Show when={props.user.relationship === "None" && !props.user.bot}>
        <button
          class={cornerButton()}
          type="button"
          aria-label={t`Add friend`}
          use:floating={{
            tooltip: { placement: "top", content: t`Add friend` },
          }}
          onClick={() => actions.run(() => props.user.addFriend())}
        >
          <Icon name="user-plus" size={18} />
        </button>
      </Show>
      {/* your own card has Edit profile where others have the message box */}
      <Show when={canEdit(props) && !props.user.self}>
        <button
          class={cornerButton()}
          type="button"
          aria-label={t`Edit profile`}
          use:floating={{
            tooltip: { placement: "top", content: t`Edit profile` },
          }}
          onClick={actions.openEdit}
        >
          <Icon name="pencil-simple" size={18} />
        </button>
      </Show>
      <MoreMenu {...props} corner />
    </>
  );
}

/**
 * Buttons on the banner edge: edit your own profile, add a bot, answer a
 * friend request. Message, Add friend and Copy ID are in the "..." menu.
 */
export function ProfilePrimaryActions(props: Props & { compact?: boolean }) {
  const actions = useProfileActions(props);

  return (
    <Row data-compact={props.compact || undefined}>
      <Show when={props.user.self}>
        <Button size="sm" shape="square" onPress={actions.openEdit}>
          <Icon name="pencil-simple" size={16} />
          <Trans>Edit profile</Trans>
        </Button>
      </Show>
      <Show when={actions.publicBot()}>
        <Button size="sm" shape="square" onPress={actions.addBot}>
          <Icon name="plus" size={16} />
          <Trans>Add bot</Trans>
        </Button>
      </Show>
      <Show when={!props.user.self && !props.compact}>
        <Show when={props.user.relationship === "Incoming"}>
          <Button
            size="sm"
            shape="square"
            onPress={() => actions.run(() => props.user.addFriend())}
          >
            <Icon name="check" size={16} />
            <Trans>Accept request</Trans>
          </Button>
          <Button
            size="sm"
            shape="square"
            variant="tonal"
            onPress={() => actions.run(() => props.user.removeFriend())}
          >
            <Trans>Ignore</Trans>
          </Button>
        </Show>
        <Show when={props.user.relationship === "Outgoing"}>
          <Button
            size="sm"
            shape="square"
            variant="tonal"
            onPress={() => actions.run(() => props.user.removeFriend())}
          >
            <Trans>Cancel request</Trans>
          </Button>
        </Show>
        <MoreMenu {...props} />
      </Show>
    </Row>
  );
}

/**
 * "..." opens the same menu as right-clicking the user
 */
function MoreMenu(props: Props & { corner?: boolean }) {
  const { t } = useLingui();

  // a native <button>: use:floating is ignored on components
  return (
    <button
      class={props.corner ? cornerButton() : plainButton()}
      // in the button row it sits at the far end
      data-more
      type="button"
      aria-label={t`More`}
      use:floating={{
        contextMenu: () => (
          <UserContextMenu
            user={props.user}
            member={props.member}
            onClose={props.onClose}
            fromProfile
          />
        ),
        contextMenuHandler: "click",
      }}
    >
      <Icon name="dots-three" size={18} />
    </button>
  );
}

/**
 * "Message @name" box at the bottom of the card; Enter sends straight into
 * the DM and opens it
 */
export function ProfileMessage(props: Props) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { showError } = useModals();
  const [value, setValue] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  async function send() {
    const content = value().trim();
    if (!content || busy()) return;
    setBusy(true);
    try {
      const channel = await props.user.openDM();
      await channel.sendMessage(content);
      setValue("");
      props.onClose();
      navigate(channel.path);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MessageBox>
      <input
        value={value()}
        disabled={busy()}
        maxLength={2000}
        placeholder={t`Message @${props.user.displayName}`}
        aria-label={t`Message @${props.user.displayName}`}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <SendButton
        type="button"
        aria-label={t`Send`}
        disabled={!value().trim() || busy()}
        onClick={send}
      >
        <Icon name="paper-plane-tilt" size={18} />
      </SendButton>
    </MessageBox>
  );
}

const Row = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    // under the name on a phone: More sits on the far end of the row
    _phone: { "& > [data-more]": { marginInlineStart: "auto" } },
    // in the small card the buttons share the width equally
    "&[data-compact] > button": { flex: "1 1 0", justifyContent: "center" },
  },
});

const iconButton = {
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: "none",
  cursor: "pointer",
  "--z-icon-color": "currentColor",
  transition: "color 0.12s ease, background-color 0.12s ease",
  _focusVisible: {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "2px",
  },
} as const;

/** Readable on any banner or theme: white on a dark square, in every profile */
const cornerButton = cva({
  base: {
    ...iconButton,
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    color: "white",
    background: "rgba(10, 12, 16, 0.72)",
    _hover: { background: "rgba(10, 12, 16, 0.88)" },
    _active: { background: "rgba(10, 12, 16, 0.96)" },
    _phone: { width: "44px", height: "44px" },
  },
});

const plainButton = cva({
  base: {
    ...iconButton,
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    color: "var(--z-icon-muted)",
    background: "transparent",
    _hover: { color: "var(--z-icon-hover)" },
    _phone: { width: "44px", height: "44px" },
  },
});

const MessageBox = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    height: "40px",
    paddingInlineStart: "12px",
    paddingInlineEnd: "4px",
    borderRadius: "8px",
    background: "var(--profile-chip, var(--z-bg-input))",
    border: "1px solid var(--profile-line, var(--z-border-subtle))",
    transition: "border-color 0.12s ease",

    "&:focus-within": {
      borderColor: "var(--z-focus)",
    },
    _phone: { height: "44px" },

    "& input": {
      flex: 1,
      minWidth: 0,
      height: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      font: "inherit",
      fontSize: "13px",
      color: "var(--profile-ink, var(--z-fg-primary))",
      "&::placeholder": { color: "var(--profile-ink-2, var(--z-fg-muted))" },
      // a phone zooms the page into anything smaller
      _phone: { fontSize: "16px" },
    },
  },
});

const SendButton = styled("button", {
  base: {
    ...iconButton,
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--z-icon-muted)",
    _phone: { width: "44px", height: "44px" },
    _hover: {
      color: "var(--profile-accent, var(--z-accent-text, var(--z-accent)))",
    },
    _disabled: {
      opacity: 0.4,
      cursor: "default",
      color: "var(--z-icon-muted)",
    },
  },
});
