import { createStore, produce } from "solid-js/store";

import type { Channel, Client, User } from "@zrzur/sdk/solid";

/**
 * Whether bots can be started in DMs on this server (`features.bot_dms`).
 * `configured()` makes it follow the moment the server's settings arrive.
 */
export function botDmsOn(client: Client | undefined) {
  return (
    !!client?.configured() && client.configuration?.features?.bot_dms === true
  );
}

/**
 * A start payload from a bot link (`/b/{id}?start=…`): 1-64 characters of
 * `A-Z`, `a-z`, `0-9`, `_` and `-`, as the server accepts them
 */
export function validStartPayload(value: string | null | undefined) {
  return !!value && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/**
 * Read a bot link: `/b/{id}?start=ref` or `/bot/{id}?start`. The `start`
 * key alone opens the conversation; a payload the server would refuse is
 * dropped, the conversation still opens.
 */
export function startOf(search: string): { payload?: string } | undefined {
  const query = new URLSearchParams(search);
  if (!query.has("start")) return undefined;
  const payload = query.get("start");
  return validStartPayload(payload) ? { payload: payload! } : {};
}

type StartState = {
  /** Bot links waiting for Start, by DM channel id (`""` = no payload) */
  waiting: Record<string, string>;
  /** Conversations where Start was pressed in this session */
  started: Record<string, true>;
};

const [state, setState] = createStore<StartState>({
  waiting: {},
  started: {},
});

export { state as botStartState };

/** A bot link was opened: its conversation shows Start with this payload */
export function waitForStart(channelId: string, payload?: string) {
  setState("waiting", channelId, payload ?? "");
  setState(
    produce((draft) => {
      delete draft.started[channelId];
    }),
  );
}

/** Start was pressed (or the person wrote): the link is used up */
export function markStarted(channelId: string) {
  setState(
    produce((draft) => {
      delete draft.waiting[channelId];
      draft.started[channelId] = true;
    }),
  );
}

/** The payload a bot link left for this conversation, if one is waiting */
export function waitingPayload(channelId: string): string | undefined {
  const payload = state.waiting[channelId];
  return payload ? payload : undefined;
}

/** The bot of a DM with a bot, else nothing */
export function dmBot(channel: Channel): User | undefined {
  return channel.type === "DirectMessage" && channel.recipient?.bot
    ? channel.recipient
    : undefined;
}

/**
 * Where Start shows in a conversation with a bot, if anywhere. A
 * conversation with a bot is like any other (owner, 2026-11-27: no card at
 * its top): writing to the bot, or using one of its commands, starts it.
 * Only a bot link that is waiting (its payload goes to the bot with Start)
 * puts Start in the bar above the message box.
 */
export function startPlace(
  client: Client,
  channel: Channel,
): "bar" | undefined {
  const bot = dmBot(channel);
  if (!botDmsOn(client) || !bot || bot.relationship === "Blocked") return;
  return state.waiting[channel.id] !== undefined ? "bar" : undefined;
}
