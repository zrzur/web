import { useLingui } from "@lingui/solid/macro";

/**
 * Plain words for why an interaction failed (the API's error type, or
 * `Timeout`): the same text in the timeline and next to a button or menu
 */
export function useInteractionErrorText() {
  const { t } = useLingui();
  return (error?: string) => {
    switch (error) {
      case "Timeout":
        return t`The bot did not respond in time.`;
      case "ApplicationOffline":
        return t`The bot is offline right now.`;
      case "ApplicationNotInstalled":
        return t`This bot is not available in this channel.`;
      case "UnknownCommand":
        return t`This command no longer exists.`;
      case "MissingPermission":
        return t`You are not allowed to do this.`;
      case "Unknown":
        return t`Couldn't reach the bot. Try again.`;
      case "FailedValidation":
        return t`Some of the values are not valid.`;
      case "InteractionExpired":
        return t`This has expired.`;
      case "TooManyRequests":
        return t`Slow down a little and try again.`;
      default:
        return t`Something went wrong.`;
    }
  };
}
