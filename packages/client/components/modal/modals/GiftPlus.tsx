import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  billingPlans,
  checkoutAvailable,
  formatPrice,
  newOrderKey,
} from "@revolt/client/billing";
import { Avatar, Dialog, DialogProps, Segmented } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

import { PaymentMethodPicker, usePaymentMethod } from "./PaymentMethodPicker";
import { Line, Notes, Summary } from "./PlusCheckout";
import { useStartPurchase } from "./billingCheckout";
import { useBillingError } from "./billingErrors";

/**
 * Give a friend Plus for 1, 3 or 12 months in one payment
 */
export function GiftPlusModal(
  props: DialogProps & Modals & { type: "gift_plus" },
) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const describe = useBillingError();
  const startPurchase = useStartPurchase();
  const pay = usePaymentMethod();

  const [recipient, setRecipient] = createSignal<string | undefined>(
    props.user?.id,
  );
  const [months, setMonths] = createSignal("1");
  const [note, setNote] = createSignal("");
  const [filter, setFilter] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [sent, setSent] = createSignal(false);

  const plans = () => billingPlans();
  const options = () =>
    (plans()?.gift_months ?? [1, 3, 12]).map((count) => ({
      value: String(count),
      label:
        count === 12
          ? t`1 year`
          : count === 1
            ? t`1 month`
            : t`${count} months`,
    }));
  const total = () =>
    formatPrice(
      (plans()?.plus_price ?? 0) * Number(months()),
      plans()?.currency ?? "",
      i18n().locale,
    );

  const friends = createMemo(() => {
    const query = filter().trim().toLowerCase();
    return client()
      .users.filter((user) => user.relationship === "Friend" && !user.bot)
      .filter(
        (user) =>
          !query ||
          user.displayName.toLowerCase().includes(query) ||
          user.username.toLowerCase().includes(query),
      )
      .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
  });

  const selected = () =>
    recipient() ? client().users.get(recipient()!) : undefined;

  async function send() {
    if (!recipient()) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await startPurchase(
        client(),
        {
          type: "PlusGift",
          user: recipient()!,
          months: Number(months()),
          note: note().trim() || undefined,
        },
        newOrderKey(),
        pay.method(),
      );
      if (result === "checkout") props.onClose();
      else setSent(true);
    } catch (err) {
      setError(describe(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      tone="premium"
      iconName="gift"
      show={props.show}
      onClose={props.onClose}
      size="md"
      title={<Trans>Gift Feather to a friend</Trans>}
      description={
        <Trans>
          One payment, straight onto their account, with a note from you. If
          they already have Feather, the time is added on.
        </Trans>
      }
      error={error()}
      isDisabled={pending()}
      actions={
        sent()
          ? [{ text: <Trans>Done</Trans> }]
          : [
              { text: <Trans>Cancel</Trans>, variant: "text" },
              {
                text: <Trans>Send gift for {total()}</Trans>,
                isLoading: pending(),
                isDisabled: !recipient() || !checkoutAvailable(),
                onClick: () => {
                  void send();
                  return false;
                },
              },
            ]
      }
    >
      <Show
        when={!sent()}
        fallback={
          <SentBox>
            <Icon name="gift" size={28} />
            <strong>
              <Trans>Gift sent</Trans>
            </strong>
            <span>
              <Trans>
                {selected()?.displayName} now has Zrzur Feather. They'll see
                your note in their subscriptions.
              </Trans>
            </span>
          </SentBox>
        }
      >
        <Body>
          <Label>
            <Trans>Who is it for?</Trans>
          </Label>
          <Search
            type="search"
            value={filter()}
            placeholder={t`Search friends`}
            aria-label={t`Search friends`}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
          <Friends role="radiogroup" aria-label={t`Friends`}>
            <Show
              when={friends().length}
              fallback={
                <Empty>
                  <Trans>
                    No friends to show. Add someone as a friend first.
                  </Trans>
                </Empty>
              }
            >
              <For each={friends()}>
                {(user) => (
                  <Friend
                    type="button"
                    role="radio"
                    aria-checked={recipient() === user.id}
                    data-selected={recipient() === user.id}
                    onClick={() => setRecipient(user.id)}
                  >
                    <Avatar
                      src={user.animatedAvatarURL}
                      fallback={user.displayName}
                      size={28}
                    />
                    <FriendName>
                      <span>{user.displayName}</span>
                      <small>{user.username}</small>
                    </FriendName>
                    <Show when={recipient() === user.id}>
                      <Icon name="check-circle" size={18} />
                    </Show>
                  </Friend>
                )}
              </For>
            </Show>
          </Friends>

          <Label>
            <Trans>How long?</Trans>
          </Label>
          <Segmented
            value={months()}
            options={options()}
            onChange={setMonths}
            aria-label={t`Gift length`}
          />

          <Label for="gift-note">
            <Trans>Note (optional)</Trans>
          </Label>
          <Note
            id="gift-note"
            maxLength={200}
            rows={2}
            value={note()}
            placeholder={t`Happy birthday!`}
            onInput={(e) => setNote(e.currentTarget.value)}
          />

          <Summary>
            <Line>
              <span>
                <Trans>Total, paid once</Trans>
              </span>
              <bdi>{total()}</bdi>
            </Line>
          </Summary>
          <PaymentMethodPicker choice={pay} disabled={pending()} />
          <Notes>
            <li>
              <Icon name="check" size={14} />
              <span>
                <Trans>Gifts don't renew. Nothing more is charged later.</Trans>
              </span>
            </li>
            <Show when={!checkoutAvailable()}>
              <li>
                <Icon name="check" size={14} />
                <span>
                  <Trans>
                    Purchases aren't open yet. Nothing can be bought or charged
                    right now.
                  </Trans>
                </span>
              </li>
            </Show>
            <Show when={plans()?.test_mode}>
              <li>
                <Icon name="check" size={14} />
                <span>
                  <Trans>Test mode: no real money is charged.</Trans>
                </span>
              </li>
            </Show>
          </Notes>
        </Body>
      </Show>
    </Dialog>
  );
}

const Body = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const Label = styled("label", {
  base: {
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

const Search = styled("input", {
  base: {
    height: "34px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    outline: "none",
    "&:focus-visible": { borderColor: "var(--z-premium)" },
  },
});

const Friends = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxHeight: "200px",
    overflowY: "auto",
    padding: "4px",
    borderRadius: "10px",
    background: "var(--z-bg-input)",
  },
});

const Friend = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 8px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-primary)",
    cursor: "pointer",
    textAlign: "start",
    "&:hover": { background: "var(--z-bg-raised)" },
    "&[data-selected=true]": {
      background: "color-mix(in srgb, var(--z-premium) 14%, transparent)",
      "& svg": { color: "var(--z-premium)" },
    },
  },
});

const FriendName = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    fontSize: "14px",
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const Empty = styled("div", {
  base: { padding: "12px", fontSize: "13px", color: "var(--z-fg-muted)" },
});

const Note = styled("textarea", {
  base: {
    resize: "none",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    "&:focus-visible": { borderColor: "var(--z-premium)" },
  },
});

const SentBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "8px",
    padding: "16px 8px",
    color: "var(--z-fg-secondary)",
    "& svg": { color: "var(--z-premium)" },
    "& strong": { fontSize: "16px", color: "var(--z-fg-primary)" },
  },
});
