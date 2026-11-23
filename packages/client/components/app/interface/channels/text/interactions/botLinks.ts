import { createStore, produce } from "solid-js/store";

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
