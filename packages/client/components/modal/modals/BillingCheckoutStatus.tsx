import {
  Match,
  Show,
  Switch,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  type OrderCheckout,
  billingApi,
  followOrder,
  formatPrice,
  isProviderUrl,
  openProviderPage,
  orderOpen,
  refreshBilling,
} from "@revolt/client/billing";
import { Dialog, DialogProps } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

import { useBillingError } from "./billingErrors";

/**
 * Where a purchase at the payment provider stands. The state always comes
 * from the Zrzur API (which asks the provider), never from the return
 * address, so closing the payment page or reloading shows the truth.
 */
export function BillingCheckoutStatusModal(
  props: DialogProps & Modals & { type: "billing_checkout_status" },
) {
  const { i18n } = useLingui();
  const client = useClient();
  const describe = useBillingError();
  const [checkout, setCheckout] = createSignal<OrderCheckout | undefined>(
    props.checkout,
  );
  const [error, setError] = createSignal<string>();
  const [cancelling, setCancelling] = createSignal(false);
  const [gaveUp, setGaveUp] = createSignal(false);
  const controller = new AbortController();

  onMount(async () => {
    const last = await followOrder(
      client(),
      props.orderId,
      setCheckout,
      controller.signal,
    );
    if (!last) setError(describe(undefined));
    else if (orderOpen(last.order.status)) setGaveUp(true);
  });
  onCleanup(() => controller.abort());

  const order = () => checkout()?.order;
  const status = () => order()?.status;
  const price = () =>
    order()
      ? formatPrice(order()!.amount, order()!.currency, i18n().locale)
      : "";
  const paymentUrl = () => {
    const url = checkout()?.checkout_url;
    return isProviderUrl(url) && orderOpen(status() ?? "Failed")
      ? url
      : undefined;
  };

  async function cancel() {
    setCancelling(true);
    setError(undefined);
    try {
      const next = await billingApi.cancelOrder(client(), props.orderId);
      setCheckout({ order: next });
    } catch (err) {
      setError(describe(err));
    } finally {
      setCancelling(false);
    }
  }

  const done = () => status() === "Paid" && order()?.fulfilled !== false;

  return (
    <Dialog
      tone="info"
      show={props.show}
      onClose={() => {
        controller.abort();
        if (done()) void refreshBilling(client());
        props.onClose();
      }}
      size="sm"
      title={
        <Switch fallback={<Trans>Waiting for your payment</Trans>}>
          <Match when={done()}>
            <Trans>Payment complete</Trans>
          </Match>
          <Match when={status() === "Paid"}>
            <Trans>Payment received</Trans>
          </Match>
          <Match when={status() === "Failed"}>
            <Trans>Payment failed</Trans>
          </Match>
          <Match when={status() === "Cancelled"}>
            <Trans>Purchase cancelled</Trans>
          </Match>
          <Match
            when={
              status() === "Refunded" ||
              status() === "PartiallyRefunded" ||
              status() === "Disputed"
            }
          >
            <Trans>Payment updated</Trans>
          </Match>
        </Switch>
      }
      error={error()}
      actions={[
        ...(paymentUrl()
          ? [
              {
                text: <Trans>Cancel purchase</Trans>,
                variant: "text" as const,
                isLoading: cancelling(),
                onClick: () => {
                  void cancel();
                  return false as const;
                },
              },
              {
                text: <Trans>Open payment page</Trans>,
                onClick: () => {
                  try {
                    openProviderPage(paymentUrl()!);
                  } catch (err) {
                    setError(describe(err));
                  }
                  return false as const;
                },
              },
            ]
          : [{ text: <Trans>Close</Trans> }]),
      ]}
    >
      <Body>
        <Show when={order()}>
          <Amount>
            <bdi>{price()}</bdi>
          </Amount>
        </Show>
        <Switch
          fallback={
            <Line>
              <Spinner />
              <span>
                <Trans>
                  Finish paying on the secure payment page that opened. This
                  window updates by itself once the payment is confirmed.
                </Trans>
              </span>
            </Line>
          }
        >
          <Match when={done()}>
            <Line data-good>
              <Icon name="check-circle" size={20} />
              <span>
                <Trans>Thank you! Everything you bought is ready to use.</Trans>
              </span>
            </Line>
          </Match>
          <Match when={status() === "Paid"}>
            <Line>
              <Spinner />
              <span>
                <Trans>Your payment was received. Setting things up…</Trans>
              </span>
            </Line>
          </Match>
          <Match when={status() === "RequiresAction"}>
            <Line>
              <Icon name="shield-check" size={20} />
              <span>
                <Trans>
                  Your bank needs you to confirm this payment on the payment
                  page.
                </Trans>
              </span>
            </Line>
          </Match>
          <Match when={status() === "Processing"}>
            <Line>
              <Spinner />
              <span>
                <Trans>
                  The payment is being confirmed. This can take a little while.
                </Trans>
              </span>
            </Line>
          </Match>
          <Match when={status() === "Failed"}>
            <Line data-bad>
              <Icon name="x-circle" size={20} />
              <span>
                <Trans>
                  The payment didn't go through, so nothing was bought. You can
                  try again with another payment method.
                </Trans>
              </span>
            </Line>
          </Match>
          <Match when={status() === "Cancelled"}>
            <Line>
              <Icon name="prohibit" size={20} />
              <span>
                <Trans>
                  This purchase was closed without payment. Nothing was charged.
                </Trans>
              </span>
            </Line>
          </Match>
          <Match
            when={status() === "Refunded" || status() === "PartiallyRefunded"}
          >
            <Line>
              <Icon name="arrow-u-up-left" size={20} />
              <span>
                <Trans>This payment was refunded.</Trans>
              </span>
            </Line>
          </Match>
          <Match when={status() === "Disputed"}>
            <Line data-bad>
              <Icon name="gavel" size={20} />
              <span>
                <Trans>
                  This payment is disputed with your bank. Contact support if
                  you have questions.
                </Trans>
              </span>
            </Line>
          </Match>
        </Switch>
        <Show when={gaveUp() && orderOpen(status() ?? "Failed")}>
          <Hint>
            <Trans>
              Still waiting. If you paid, it will show up in Subscriptions as
              soon as the payment is confirmed.
            </Trans>
          </Hint>
        </Show>
        <Show when={order()?.test}>
          <Hint>
            <Trans>Test mode: no real money is charged.</Trans>
          </Hint>
        </Show>
      </Body>
    </Dialog>
  );
}

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Amount = styled("div", {
  base: {
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
  },
});

const Line = styled("div", {
  base: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    "& svg": { flexShrink: 0, marginTop: "1px" },
    "&[data-good] svg": { color: "var(--z-premium)" },
    "&[data-bad] svg": { color: "var(--z-danger, #e5484d)" },
  },
});

const Hint = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--z-fg-tertiary, var(--z-fg-secondary))",
  },
});

const Spinner = styled("span", {
  base: {
    flexShrink: 0,
    width: "18px",
    height: "18px",
    marginTop: "1px",
    borderRadius: "50%",
    border: "2px solid var(--z-bg-input)",
    borderTopColor: "var(--z-premium)",
    animation: "spin 0.9s linear infinite",
  },
});
