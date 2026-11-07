import type { Client } from "@zrzur/sdk/solid";

import {
  type OrderProduct,
  type PaymentMethod,
  purchase,
} from "@revolt/client/billing";

import { useModals } from "..";

/**
 * Start a purchase. With a payment provider the payment page opens and a
 * status window follows the order from the API; returns "checkout" so the
 * calling window can close. With simulated payments it returns "done" once
 * the purchase is delivered.
 */
export function useStartPurchase() {
  const { openModal } = useModals();

  return async (
    client: Client,
    product: OrderProduct,
    key: string,
    provider?: PaymentMethod,
  ) => {
    const result = await purchase(client, product, key, provider);
    if (result.kind === "checkout") {
      openModal({
        type: "billing_checkout_status",
        orderId: result.order._id,
        checkout: { order: result.order, checkout_url: result.url },
      });
    }
    return result.kind;
  };
}
