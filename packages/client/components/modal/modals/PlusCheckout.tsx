import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  billingPlans,
  checkoutAvailable,
  formatPrice,
  newOrderKey,
} from "@revolt/client/billing";
import { useTime } from "@revolt/i18n";
import { Dialog, DialogProps } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

import { useStartPurchase } from "./billingCheckout";
import { useBillingError } from "./billingErrors";
import { PaymentMethodPicker, usePaymentMethod } from "./PaymentMethodPicker";

/**
 * Confirm starting Zrzur Plus
 */
export function PlusCheckoutModal(
  props: DialogProps & Modals & { type: "plus_checkout" },
) {
  const { t, i18n } = useLingui();
  const dayjs = useTime();
  const client = useClient();
  const describe = useBillingError();
  const startPurchase = useStartPurchase();
  const pay = usePaymentMethod();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  // one key per window: retries and double clicks never buy twice
  const key = newOrderKey();

  const plans = () => billingPlans();
  const price = () =>
    formatPrice(
      plans()?.plus_price ?? 0,
      plans()?.currency ?? "",
      i18n().locale,
    );
  const renews = () => dayjs().add(30, "day").format("LL");

  async function confirm() {
    if (!checkoutAvailable()) return;
    setPending(true);
    setError(undefined);
    try {
      await startPurchase(client(), { type: "Plus" }, key, pay.method());
      props.onClose();
    } catch (err) {
      setError(describe(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      tone="premium"
      show={props.show}
      onClose={props.onClose}
      size="sm"
      title={<Trans>Get Zrzur Feather</Trans>}
      error={error()}
      isDisabled={pending()}
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: checkoutAvailable() ? (
            plans()?.provider && plans()?.provider !== "test" ? (
              <Trans>Continue to payment</Trans>
            ) : (
              <Trans>Start Feather</Trans>
            )
          ) : (
            <Trans>Not open yet</Trans>
          ),
          isLoading: pending(),
          isDisabled: !checkoutAvailable(),
          onClick: () => {
            void confirm();
            return false;
          },
        },
      ]}
    >
      <Summary>
        <Line>
          <span>
            <Trans>Zrzur Feather, monthly</Trans>
          </span>
          <bdi>{t`${price()}/month`}</bdi>
        </Line>
        <Line data-muted>
          <span>
            <Trans>Next renewal</Trans>
          </span>
          <span>{renews()}</span>
        </Line>
        <Show when={plans()?.plus_free_supercharges}>
          <Line data-muted>
            <span>
              <Trans>Included Wings</Trans>
            </span>
            <span>{plans()!.plus_free_supercharges}</span>
          </Line>
        </Show>
      </Summary>
      <PaymentMethodPicker choice={pay} disabled={pending()} />
      <Notes>
        <For
          each={[
            t`Renews automatically every month until you cancel.`,
            t`Cancel any time in Settings, Subscriptions. You keep Feather until the end of the month you paid for.`,
            ...(!checkoutAvailable()
              ? [
                  t`Purchases aren't open yet. Nothing can be bought or charged right now.`,
                ]
              : plans()?.provider && plans()?.provider !== "test"
                ? [
                    t`You pay on our payment partner's secure page. Zrzur never sees your card details.`,
                  ]
                : []),
            ...(plans()?.test_mode
              ? plans()?.provider && plans()?.provider !== "test"
                ? [
                    t`Test mode: use a test card from the payment provider. No real money is charged.`,
                  ]
                : [
                    t`Test mode: nothing is charged and no card details are needed.`,
                  ]
              : []),
          ]}
        >
          {(note) => (
            <li>
              <Icon name="check" size={14} />
              <span>{note}</span>
            </li>
          )}
        </For>
      </Notes>
    </Dialog>
  );
}

export const Summary = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "14px",
    borderRadius: "12px",
    background: "var(--z-bg-input)",
    fontSize: "14px",
  },
});

export const Line = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    color: "var(--z-fg-primary)",
    fontWeight: 600,
    "&[data-muted]": { fontWeight: 400, color: "var(--z-fg-secondary)" },
  },
});

export const Notes = styled("ul", {
  base: {
    margin: "12px 0 0",
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "13px",
    lineHeight: "19px",
    color: "var(--z-fg-secondary)",
    "& li": { display: "flex", gap: "8px", alignItems: "flex-start" },
    "& svg": { flexShrink: 0, marginTop: "3px", color: "var(--z-premium)" },
  },
});
