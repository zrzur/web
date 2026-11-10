import { For, Show, createMemo, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";
import { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useState } from "@revolt/state";
import { HIDDEN } from "@revolt/state/streamer";
import {
  Avatar,
  Dialog,
  DialogProps,
  FloatingSelect,
  MenuItem,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

import { getInviteLink } from "./inviteLink";
import {
  DEFAULT_EXPIRY,
  EXPIRY_CHOICES,
  USES_CHOICES,
  inviteRequest,
} from "./inviteOptions";

export { getInviteLink };

/**
 * Invite people: send the link straight to friends, or copy it.
 *
 * [ Invite friends to Server            x ]
 * [ (search friends)                      ]
 * [ (o) Friend          @name   [Invite]  ]
 * SEND AN INVITE LINK
 * [ https://…/invite/abc      ] [ Copy ]
 * [ Expires after: 7 days ] [ Max uses: No limit ]
 * This link expires after 7 days.
 */
export function CreateInviteModal(
  props: DialogProps & Modals & { type: "create_invite" },
) {
  const { t } = useLingui();
  const { showError } = useModals();
  const client = useClient();
  const instance = useInstance();
  const state = useState();
  const [link, setLink] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [sent, setSent] = createSignal<Record<string, "sending" | "sent">>({});

  const [expiry, setExpiry] = createSignal<number | null>(DEFAULT_EXPIRY);
  const [maxUses, setMaxUses] = createSignal(0);

  const fetchInvite = useMutation(() => ({
    mutationFn: () =>
      props.channel
        .createInvite(inviteRequest(expiry(), maxUses()))
        .then(({ _id }) => setLink(getInviteLink(_id, instance))),
    onError: showError,
  }));
  onMount(() => fetchInvite.mutate());

  /** a changed choice makes a new link (the old one keeps its own rules) */
  function choose(apply: () => void) {
    apply();
    setLink("");
    setSent({});
    fetchInvite.mutate();
  }

  const expiryLabel = (choice: number | null) => {
    switch (choice) {
      case 1800:
        return t`30 minutes`;
      case 3600:
        return t`1 hour`;
      case 6 * 3600:
        return t`6 hours`;
      case 12 * 3600:
        return t`12 hours`;
      case 86400:
        return t`1 day`;
      case DEFAULT_EXPIRY:
        return t`7 days`;
      default:
        return t`Never`;
    }
  };

  const place = () => props.channel.server?.name ?? props.channel.name ?? "";

  const friends = createMemo(() => {
    const needle = query().trim().toLowerCase();
    return client()
      .users.filter((user) => user.relationship === "Friend")
      .filter(
        (user) =>
          !needle ||
          user.username.toLowerCase().includes(needle) ||
          user.displayName.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, 50);
  });

  async function invite(user: User) {
    if (!link() || sent()[user.id]) return;
    setSent((state) => ({ ...state, [user.id]: "sending" }));
    try {
      const dm = await user.openDM();
      await dm.sendMessage(link());
      setSent((state) => ({ ...state, [user.id]: "sent" }));
    } catch (error) {
      setSent((state) => {
        const next = { ...state };
        delete next[user.id];
        return next;
      });
      showError(error);
    }
  }

  async function copy() {
    if (!link()) return;
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the field stays selectable for manual copy */
    }
  }

  return (
    <Dialog
      tone="invite"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Invite friends to {place()}</Trans>}
      description={
        <Trans>Send it straight to a friend, or share the link.</Trans>
      }
      width={480}
    >
      <Body>
        <Search>
          <Icon name="magnifying-glass" size={16} />
          <input
            type="search"
            placeholder={t`Search for friends`}
            aria-label={t`Search for friends`}
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </Search>

        <Show
          when={friends().length}
          fallback={
            <Empty>
              <Show
                when={query().trim()}
                fallback={
                  <Trans>
                    Add some friends first, or share the link below.
                  </Trans>
                }
              >
                <Trans>No friends match your search.</Trans>
              </Show>
            </Empty>
          }
        >
          <Friends>
            <For each={friends()}>
              {(user) => (
                <Friend>
                  <Avatar
                    size={32}
                    src={user.animatedAvatarURL}
                    fallback={user.displayName}
                  />
                  <span>
                    <strong>{user.displayName}</strong>
                    <small>@{user.username}</small>
                  </span>
                  <InviteButton
                    type="button"
                    data-state={sent()[user.id]}
                    disabled={!link() || !!sent()[user.id]}
                    onClick={() => void invite(user)}
                  >
                    <Show
                      when={sent()[user.id] === "sent"}
                      fallback={<Trans>Invite</Trans>}
                    >
                      <Icon name="check" size={14} />
                      <Trans>Sent</Trans>
                    </Show>
                  </InviteButton>
                </Friend>
              )}
            </For>
          </Friends>
        </Show>

        <Label>
          <Trans>Or send an invite link to a friend</Trans>
        </Label>
        <LinkRow>
          <Icon name="link" size={16} />
          <input
            readOnly
            aria-label={t`Invite link`}
            value={
              fetchInvite.isPending
                ? t`Generating invite…`
                : // streamer mode: Copy and Send still work, the link stays off screen
                  state.settings.streamerMode && link()
                  ? HIDDEN
                  : link()
            }
            data-testid="invite-link"
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton
            type="button"
            data-copied={copied()}
            disabled={!link()}
            onClick={() => void copy()}
          >
            <Show when={copied()} fallback={<Trans>Copy</Trans>}>
              <Icon name="check" size={16} />
              <Trans>Copied</Trans>
            </Show>
          </CopyButton>
        </LinkRow>
        <Choices>
          <Choice>
            <span>
              <Trans>Expires after</Trans>
            </span>
            <FloatingSelect
              value={String(expiry())}
              disabled={fetchInvite.isPending}
              onChange={(e) => {
                const value = e.currentTarget.value;
                choose(() =>
                  setExpiry(value === "null" ? null : Number(value)),
                );
              }}
            >
              <For each={EXPIRY_CHOICES}>
                {(choice) => (
                  <MenuItem value={String(choice)}>
                    {expiryLabel(choice)}
                  </MenuItem>
                )}
              </For>
            </FloatingSelect>
          </Choice>
          <Choice>
            <span>
              <Trans>Max uses</Trans>
            </span>
            <FloatingSelect
              value={String(maxUses())}
              disabled={fetchInvite.isPending}
              onChange={(e) => {
                const value = Number(e.currentTarget.value);
                choose(() => setMaxUses(value));
              }}
            >
              <For each={USES_CHOICES}>
                {(choice) => (
                  <MenuItem value={String(choice)}>
                    {choice ? String(choice) : t`No limit`}
                  </MenuItem>
                )}
              </For>
            </FloatingSelect>
          </Choice>
        </Choices>
        <Note>
          <Show
            when={expiry() !== null}
            fallback={<Trans>This link never expires.</Trans>}
          >
            <Trans>This link expires after {expiryLabel(expiry())}.</Trans>
          </Show>
        </Note>
      </Body>
    </Dialog>
  );
}

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
  },
});

const field = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  // same recessed well as <TextField>
  height: "44px",
  paddingInline: "14px",
  borderRadius: "var(--z-radius, 10px)",
  border: "1px solid color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
  background: "var(--z-field-bg)",
  boxShadow: "var(--z-field-shadow)",
  color: "var(--z-fg-muted)",
  transition:
    "border-color 0.12s ease, box-shadow 0.22s ease, color 0.12s ease",
  "--z-icon-color": "currentColor",
  _hover: {
    borderColor: "color-mix(in srgb, var(--z-fg-primary) 18%, transparent)",
  },
  // the shared field focus: a crisp ring, no coloured glow
  _focusWithin: {
    borderColor: "var(--z-accent)",
    boxShadow: "var(--z-field-focus-shadow)",
  },

  "& input": {
    flex: 1,
    minWidth: 0,
    height: "100%",
    padding: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "14px",
  },
  "& input::placeholder": { color: "var(--z-fg-muted)" },
  "& input::-webkit-search-cancel-button": { display: "none" },
} as const;

const Search = styled("label", { base: field });

const Friends = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    maxHeight: "240px",
    overflowY: "auto",
    marginInline: "-6px",
  },
});

const Friend = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px",
    borderRadius: "var(--z-radius, 10px)",
    _hover: { background: "var(--z-nav-hover)" },

    "& > span": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
    },
    "& strong, & small": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
    "& strong": { fontSize: "14px", fontWeight: 600 },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const button = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  flexShrink: 0,
  border: "none",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
  "--z-icon-color": "currentColor",
  transition:
    "background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease, transform 80ms ease",
  _motionReduce: { transition: "none" },
  _focusVisible: {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "2px",
  },
} as const;

const InviteButton = styled("button", {
  base: {
    ...button,
    height: "32px",
    paddingInline: "14px",
    borderRadius: "calc(var(--z-radius, 10px) - 2px)",
    fontSize: "13px",
    // secondary weight: the dialog has no single primary action per row
    color: "var(--z-fg-primary)",
    background: "var(--z-slate-1)",
    border:
      "1px solid color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    _hover: {
      borderColor: "var(--z-accent)",
      background:
        "color-mix(in srgb, var(--z-accent) 14%, var(--z-slate-1, transparent))",
    },
    "&:active": { transform: "scale(0.97)" },
    _disabled: { cursor: "default" },
    "&[data-state='sending']": { opacity: 0.6 },
    // sent: the success colour as text on its own tint
    "&[data-state='sent']": {
      borderColor: "color-mix(in srgb, var(--z-live) 38%, transparent)",
      color: "var(--z-live)",
      background: "color-mix(in srgb, var(--z-live) 14%, transparent)",
    },
  },
});

const Label = styled("span", {
  base: {
    marginTop: "8px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-secondary)",
  },
});

const LinkRow = styled("div", {
  base: {
    ...field,
    paddingInlineEnd: "4px",
    "& input": { ...field["& input"], fontSize: "14px", cursor: "text" },
  },
});

const CopyButton = styled("button", {
  base: {
    ...button,
    height: "34px",
    minWidth: "84px",
    paddingInline: "16px",
    borderRadius: "calc(var(--z-radius, 10px) - 3px)",
    fontSize: "14px",
    color: "var(--z-on-accent, #fff)",
    background:
      "linear-gradient(180deg, var(--z-accent-fill, var(--z-accent)), var(--z-accent-hover, var(--z-accent)))",
    boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.14)",
    _hover: { background: "var(--z-accent-hover, var(--z-accent))" },
    "&:active": { transform: "scale(0.97)" },
    _disabled: { opacity: 0.5, cursor: "default" },
    // copied: white on the success colour is unreadable, so tint instead
    "&[data-copied='true'], &[data-copied='true']:hover": {
      color: "var(--z-live)",
      background: "color-mix(in srgb, var(--z-live) 16%, transparent)",
      boxShadow:
        "inset 0 0 0 1px color-mix(in srgb, var(--z-live) 40%, transparent)",
    },
  },
});

const Empty = styled("p", {
  base: {
    margin: "2px 2px 0",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const Choices = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    // one column on phones
    "@media (max-width: 600px)": { gridTemplateColumns: "1fr" },
  },
});

const Choice = styled("label", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});
