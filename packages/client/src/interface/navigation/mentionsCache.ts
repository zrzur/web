import type { Client, Message } from "@zrzur/sdk/solid";
import { type Accessor, createSignal } from "solid-js";

import { holdMessages } from "@revolt/client/messagePruner";

/** The mentions last read, per account; kept in the message cache */
const cache = new WeakMap<Client, Message[]>();
let heldIds: string[] = [];
holdMessages(() => heldIds);

/** A list that reads like a Solid resource (state, loading, error) */
export type MentionsList = Accessor<Message[] | undefined> & {
  readonly state: "pending" | "ready" | "errored";
  readonly loading: boolean;
  readonly error: unknown;
};

/**
 * The last 50 mentions for the mentions box and the phone's notifications:
 * the list read last time shows at once and is refreshed behind it (opening
 * either used to wait for the server each time, with a spinner)
 */
export function mentionsList(client: Client): MentionsList {
  const [list, setList] = createSignal(cache.get(client));
  const [error, setError] = createSignal<unknown>();

  client.fetchMentions(50).then(
    (fresh) => {
      cache.set(client, fresh);
      heldIds = fresh.map((message) => message.id);
      setList(fresh);
    },
    // a failed refresh keeps the list shown; only an empty box says so
    (failure) => {
      if (!list()) setError(failure);
    },
  );

  const accessor = (() => list()) as MentionsList;
  Object.defineProperties(accessor, {
    state: {
      get: () =>
        list() !== undefined ? "ready" : error() ? "errored" : "pending",
    },
    loading: { get: () => list() === undefined && !error() },
    error: { get: () => error() },
  });
  return accessor;
}
