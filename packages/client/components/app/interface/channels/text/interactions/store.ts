import { createStore, produce } from "solid-js/store";

import { type Client, withoutNull } from "@zrzur/sdk/solid";

import { InteractionError, interactionApi, nonce } from "./api";
import { isInteractionEvent } from "./types";
import type {
  ApplicationCommand,
  CreateInteraction,
  DataOption,
  EphemeralMessage,
  InteractionEvent,
  Modal,
  ModalFieldValue,
  OptionChoice,
  ServerCommands,
} from "./types";

/** An interaction this user started and is waiting on */
export type PendingInteraction = {
  id: string;
  channelId: string;
  applicationId: string;
  /** What to show while waiting, e.g. `/hello` */
  label?: string;
  state: "pending" | "deferred" | "failed";
  /** Error type from the API, or `Timeout` */
  error?: string;
  /** Component that started it, so its button shows progress */
  componentKey?: string;
  /** When it started (ms), to place it in the timeline */
  createdAt: number;
};

type InteractionState = {
  /** Private answers per channel; never stored on the server as messages */
  ephemeral: Record<string, EphemeralMessage[]>;
  pending: Record<string, PendingInteraction>;
  /** Components waiting for an answer, by `messageId:customId` */
  busy: Record<string, true>;
  modal?: {
    id: string;
    channelId: string;
    modal: Modal;
    /** The bot the answers go to */
    applicationId?: string;
  };
  commands: Record<string, ServerCommands>;
  /** What started each interaction, e.g. `/hello`, for the answer's header */
  labels: Record<string, string>;
};

const [state, setState] = createStore<InteractionState>({
  ephemeral: {},
  pending: {},
  busy: {},
  commands: {},
  labels: {},
});

export { state as interactionState };

/** How long after the deadline we wait before calling it a timeout */
const GRACE_MS = 1500;
/** Private answers live as long as their interaction token */
const EPHEMERAL_LIFETIME_MS = 15 * 60 * 1000;

const autocompleteWaiters = new Map<
  string,
  (choices: OptionChoice[]) => void
>();
// A fast bot can answer before our own request returns; keep such events briefly
const earlyStates = new Map<
  string,
  "Deferred" | "DeferredUpdate" | "Responded" | "Failed"
>();
const earlyChoices = new Map<string, OptionChoice[]>();
function remember<T>(map: Map<string, T>, id: string, value: T) {
  map.set(id, value);
  setTimeout(() => map.delete(id), 10_000);
}
const commandRequests = new Map<string, Promise<ServerCommands>>();
const attached = new WeakSet<Client>();

function finish(id: string) {
  const pending = state.pending[id];
  setState(
    produce((draft) => {
      if (pending?.componentKey) delete draft.busy[pending.componentKey];
      delete draft.pending[id];
    }),
  );
}

function fail(id: string, error: string) {
  const pending = state.pending[id];
  setState(
    produce((draft) => {
      if (pending?.componentKey) delete draft.busy[pending.componentKey];
      const entry = draft.pending[id];
      if (entry) {
        entry.state = "failed";
        entry.error = error;
      }
    }),
  );
  // the message stays a little while so it can be read
  setTimeout(() => {
    if (state.pending[id]?.state === "failed") finish(id);
  }, 8000);
}

function addEphemeral(message: EphemeralMessage) {
  setState(
    produce((draft) => {
      const list = (draft.ephemeral[message.channel_id] ??= []);
      const index = list.findIndex((m) => m._id === message._id);
      if (index >= 0) list[index] = message;
      else list.push(message);
    }),
  );
  setTimeout(
    () => dismissEphemeral(message.channel_id, message._id),
    EPHEMERAL_LIFETIME_MS,
  );
}

export function dismissEphemeral(channelId: string, messageId: string) {
  setState(
    produce((draft) => {
      const list = draft.ephemeral[channelId];
      if (list) {
        draft.ephemeral[channelId] = list.filter((m) => m._id !== messageId);
      }
    }),
  );
}

function onEvent(event: InteractionEvent) {
  switch (event.type) {
    case "InteractionStateUpdate": {
      if (!state.pending[event.id]) {
        remember(earlyStates, event.id, event.state);
        return;
      }
      if (event.state === "Deferred") {
        // the bot is preparing an answer: "thinking…" until it arrives; a
        // button or menu stops waiting, as the answer is a message of its own
        setState(
          produce((draft) => {
            const entry = draft.pending[event.id];
            if (entry) entry.state = "deferred";
            if (entry?.componentKey) delete draft.busy[entry.componentKey];
          }),
        );
      } else if (event.state === "DeferredUpdate") {
        // the bot will change the message itself: nothing more to show
        finish(event.id);
      } else if (event.state === "Failed") {
        fail(event.id, "Timeout");
      } else {
        finish(event.id);
      }
      break;
    }
    case "EphemeralMessageCreate":
    case "EphemeralMessageUpdate":
      addEphemeral(event.message);
      break;
    case "EphemeralMessageDelete":
      dismissEphemeral(event.channel_id, event.id);
      break;
    case "InteractionModal":
      setState("modal", {
        id: event.id,
        channelId: event.channel_id,
        modal: event.modal,
        applicationId: state.pending[event.id]?.applicationId,
      });
      break;
    case "InteractionAutocompleteResult":
      if (autocompleteWaiters.has(event.id)) {
        autocompleteWaiters.get(event.id)!(event.choices);
        autocompleteWaiters.delete(event.id);
      } else {
        remember(earlyChoices, event.id, event.choices);
      }
      break;
    case "ApplicationCommandsUpdate":
      commandRequests.delete(event.server_id);
      setState(
        produce((draft) => {
          delete draft.commands[event.server_id];
        }),
      );
      break;
  }
}

/** Listen to the gateway once per client */
export function attachInteractions(client: Client) {
  if (attached.has(client)) return;
  attached.add(client);
  client.events.on("event", (event) => {
    if (isInteractionEvent(event)) onEvent(withoutNull(event));
  });
}

/** Commands of the bots installed in a server, fetched once until they change */
export function loadServerCommands(client: Client, serverId: string) {
  if (state.commands[serverId])
    return Promise.resolve(state.commands[serverId]);
  let request = commandRequests.get(serverId);
  if (!request) {
    request = interactionApi
      .serverCommands(client, serverId)
      .then((commands) => {
        setState("commands", serverId, commands);
        return commands;
      });
    request.catch(() => commandRequests.delete(serverId));
    commandRequests.set(serverId, request);
  }
  return request;
}

async function start(
  client: Client,
  data: CreateInteraction,
  extra: { label?: string; componentKey?: string },
) {
  if (extra.componentKey) setState("busy", extra.componentKey, true);
  try {
    const accepted = await interactionApi.create(client, data);
    // a retried request returns an interaction we may already track
    // a form can arrive before this answer: say which bot opened it
    if (state.modal?.id === accepted._id && !state.modal.applicationId) {
      setState("modal", "applicationId", accepted.application_id);
    }
    if (!state.pending[accepted._id]) {
      setState("pending", accepted._id, {
        id: accepted._id,
        channelId: data.channel_id,
        applicationId: accepted.application_id,
        label: extra.label,
        state: "pending",
        componentKey: extra.componentKey,
        createdAt: Date.now(),
      });
      if (extra.label) setState("labels", accepted._id, extra.label);
      const waitMs =
        new Date(accepted.respond_by).getTime() - Date.now() + GRACE_MS;
      setTimeout(
        () => {
          if (state.pending[accepted._id]?.state === "pending") {
            fail(accepted._id, "Timeout");
          }
        },
        Math.max(waitMs, GRACE_MS),
      );
      const expiresMs = new Date(accepted.expires_at).getTime() - Date.now();
      setTimeout(
        () => {
          if (state.pending[accepted._id]?.state === "deferred") {
            fail(accepted._id, "Timeout");
          }
        },
        Math.max(expiresMs, GRACE_MS),
      );
      const early = earlyStates.get(accepted._id);
      if (early) {
        earlyStates.delete(accepted._id);
        onEvent({
          type: "InteractionStateUpdate",
          id: accepted._id,
          channel_id: data.channel_id,
          state: early,
        });
      }
    }
    return accepted;
  } catch (error) {
    if (extra.componentKey) {
      setState(
        produce((draft) => {
          delete draft.busy[extra.componentKey!];
        }),
      );
    }
    // show the failure where the answer would have appeared
    const id = `local-${nonce()}`;
    setState("pending", id, {
      id,
      channelId: data.channel_id,
      applicationId: data.application_id ?? "",
      label: extra.label,
      state: "pending",
      createdAt: Date.now(),
    });
    fail(id, error instanceof InteractionError ? error.type : "Unknown");
    throw error;
  }
}

export function runCommand(
  client: Client,
  channelId: string,
  command: ApplicationCommand,
  options: DataOption[],
  targetId?: string,
) {
  return start(
    client,
    {
      type: "Command",
      application_id: command.application_id,
      channel_id: channelId,
      command_id: command._id,
      command_version: command.version,
      options,
      target_id: targetId,
      nonce: nonce(),
      locale: navigator.language,
    },
    { label: command.type === "ChatInput" ? `/${command.name}` : command.name },
  );
}

export function useComponent(
  client: Client,
  channelId: string,
  messageId: string,
  customId: string,
  values?: string[],
) {
  const componentKey = `${messageId}:${customId}`;
  // double clicks while the first one is on its way do nothing
  if (state.busy[componentKey]) return Promise.resolve(undefined);
  return start(
    client,
    {
      type: "Component",
      channel_id: channelId,
      message_id: messageId,
      custom_id: customId,
      values,
      nonce: nonce(),
      locale: navigator.language,
    },
    { componentKey },
  );
}

export function submitModal(
  client: Client,
  parentId: string,
  channelId: string,
  customId: string,
  fields: ModalFieldValue[],
) {
  return start(
    client,
    {
      type: "ModalSubmit",
      channel_id: channelId,
      parent_id: parentId,
      custom_id: customId,
      fields,
      nonce: nonce(),
      locale: navigator.language,
    },
    {},
  );
}

export function closeModal() {
  setState("modal", undefined);
}

/**
 * Ask the bot for suggestions. Resolves with no choices on timeout or when
 * `signal` aborts (a newer keystroke).
 */
export async function requestAutocomplete(
  client: Client,
  channelId: string,
  command: ApplicationCommand,
  options: DataOption[],
  focused: string,
  signal: AbortSignal,
): Promise<OptionChoice[]> {
  const accepted = await interactionApi.autocomplete(
    client,
    {
      type: "Autocomplete",
      application_id: command.application_id,
      channel_id: channelId,
      command_id: command._id,
      command_version: command.version,
      options,
      focused,
      nonce: nonce(),
      locale: navigator.language,
    },
    signal,
  );
  const early = earlyChoices.get(accepted._id);
  if (early) {
    earlyChoices.delete(accepted._id);
    return early;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      autocompleteWaiters.delete(accepted._id);
      resolve([]);
    }, 3000 + GRACE_MS);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      autocompleteWaiters.delete(accepted._id);
      resolve([]);
    });
    autocompleteWaiters.set(accepted._id, (choices) => {
      clearTimeout(timer);
      resolve(choices);
    });
  });
}
