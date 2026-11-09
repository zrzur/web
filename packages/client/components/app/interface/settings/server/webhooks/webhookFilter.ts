/** Which webhooks to list, by who made them */
export type WebhookMaker = "all" | "bots" | "people";

/** Webhooks made by bots, by people, or all of them */
export function filterWebhooks<T extends { creatorId: string }>(
  hooks: T[],
  maker: WebhookMaker,
  isBot: (userId: string) => boolean,
): T[] {
  if (maker === "all") return hooks;
  return hooks.filter((hook) => isBot(hook.creatorId) === (maker === "bots"));
}
