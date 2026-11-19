import { Show, createEffect, createSignal, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient, useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";
import { A } from "@revolt/routing";
import { Icon } from "@revolt/ui/icons";

import { mapMailProvider } from "../flows/MailProvider";

import { timeLeft } from "./inviteLogic";

/**
 * Shown across the top of the app to an account made from an invite link
 * until its email is confirmed: what to do, by when, and a way to the mail.
 * It stays until then (the account is removed after the deadline), and it
 * goes away by itself once the address is confirmed, also on another device.
 */
export function ConfirmEmailStrip() {
  const { t } = useLingui();
  const client = useClient();
  const lifecycle = useClientLifecycle();
  const [account, setAccount] = createSignal<{
    email: string;
    confirm_by?: string;
  }>();

  async function load() {
    try {
      setAccount(
        (await client().api.get("/auth/account/")) as {
          email: string;
          confirm_by?: string;
        },
      );
    } catch {
      // not now: the next look tries again
    }
  }

  createEffect(() => {
    if (!lifecycle.isLoggedIn()) return setAccount(undefined);
    if (lifecycle.lifecycle.state() !== State.Connected) return;
    void load();

    // confirmed in the mail app or another tab: look again on return
    const onFocus = () => account()?.confirm_by && void load();
    window.addEventListener("focus", onFocus);
    onCleanup(() => window.removeEventListener("focus", onFocus));
  });

  const left = () => timeLeft(account()!.confirm_by!);
  const provider = () => mapMailProvider(account()?.email);

  return (
    <Show when={account()?.confirm_by}>
      <Strip role="status" data-confirm-email>
        <Message>
          <Icon name="envelope" size={20} aria-hidden="true" />
          <span>
            <Show
              when={left().unit === "days"}
              fallback={
                <Trans>
                  Confirm your email within {left().count} hours to keep this
                  account.
                </Trans>
              }
            >
              <Trans>
                Confirm your email within {left().count} days to keep this
                account.
              </Trans>
            </Show>
          </span>
        </Message>
        <Links>
          <Show when={provider()}>
            <a href={provider()![1]} target="_blank" rel="noopener noreferrer">
              <Trans>Open mail</Trans>
            </a>
          </Show>
          <A href="/login/resend" aria-label={t`Send the email again`}>
            <Trans>Send again</Trans>
          </A>
        </Links>
      </Strip>
    </Show>
  );
}

const Strip = styled("div", {
  base: {
    flex: "none",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0 12px",
    minHeight: "48px",
    padding: "8px 16px",
    // on phones the app's root is two screens wide while the menu shows:
    // the strip stays one screen wide, where the person looks
    width: "100%",
    maxWidth: "100vw",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-raised)",
    borderBlockEnd: "1px solid var(--z-border-soft)",
  },
});

const Message = styled("div", {
  base: {
    flex: "1 1 240px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    minHeight: "44px",
    "& > svg": { flex: "none", color: "var(--z-warning, var(--z-fg-muted))" },
    "& > span": { minWidth: 0 },
  },
});

const Links = styled("div", {
  base: {
    display: "flex",
    gap: "16px",
    marginInlineStart: "auto",
    "& a": {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "44px",
      fontWeight: 600,
      whiteSpace: "nowrap",
      color: "var(--z-accent-text)",
      textDecoration: "none",
      borderRadius: "var(--z-radius-sm, 6px)",
    },
    "& a:hover": { textDecoration: "underline" },
    "& a:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});
