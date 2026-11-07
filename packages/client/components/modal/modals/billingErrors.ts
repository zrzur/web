import { useLingui } from "@lingui/solid/macro";

import { useError } from "@revolt/i18n";

/**
 * Turn a billing API error into a sentence
 */
export function useBillingError() {
  const { t } = useLingui();
  const describeError = useError();

  return (error: unknown) => {
    let type: string | undefined;
    let feature: string | undefined;
    try {
      const parsed = (typeof error === "string" ? JSON.parse(error) : error) as
        | { type?: string; feature?: string }
        | undefined;
      type = parsed?.type;
      feature = parsed?.feature;
    } catch {
      type = undefined;
    }

    switch (type) {
      case "FeatureDisabled":
        return feature === "billing_checkout"
          ? t`Purchases aren't open yet. Nothing was charged.`
          : t`Purchases aren't available right now.`;
      case "ProxyError":
        return t`The payment provider couldn't be reached. Nothing was charged; try again in a moment.`;
      case "BadCheckout":
        return t`The payment page address looked wrong, so it wasn't opened. Try again.`;
      case "NotFound":
        return t`That couldn't be found. It may have changed, try again.`;
      case "InvalidOperation":
        return t`That can't be done right now.`;
      case "IsBot":
        return t`Bots can't have Feather.`;
      case "UnknownUser":
        return t`That user couldn't be found.`;
      case "Blocked":
        return t`You can't send a gift to this person.`;
      case "TooManySupercharges":
        return t`You have as many Wings as one member can hold.`;
      case "PromotionSlotsFull":
        return t`Every spot in the top row is taken. Try again when one opens.`;
      case "NotOnDiscover":
        return t`This server has to be approved for Discover first.`;
      case "Refunded":
        return t`Payment went through but this couldn't be delivered any more, so it was refunded.`;
      case "OrderCancelled":
        return t`This purchase was cancelled. Start it again.`;
      case "TooManyBotCreations":
        return describeError(error);
      case "MissingPermission":
        return t`You need the Manage Server permission for this.`;
      default:
        return t`Something went wrong. Try again.`;
    }
  };
}
