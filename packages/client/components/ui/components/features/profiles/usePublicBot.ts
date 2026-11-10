import { Accessor, createEffect, createSignal, onCleanup } from "solid-js";

import { PublicBot } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";

/**
 * A bot's public page, from the SDK's cache when it is fresh (no request,
 * no flash), else fetched once however many parts of the card ask. A signal,
 * not a resource: a pending resource would suspend the channel's <Suspense>
 * and detach the message list behind the profile card.
 */
export function usePublicBot(
  botId: Accessor<string | undefined>,
): Accessor<PublicBot | undefined> {
  const client = useClient();
  const [bot, setBot] = createSignal<PublicBot>();
  createEffect(() => {
    const id = botId();
    if (!id) return setBot(undefined);
    const kept = client().bots.getPublic(id);
    setBot(kept);
    if (kept) return;
    let current = true;
    onCleanup(() => (current = false));
    client()
      .bots.fetchPublic(id)
      .then((answer) => current && setBot(answer))
      .catch(() => undefined);
  });
  return bot;
}
