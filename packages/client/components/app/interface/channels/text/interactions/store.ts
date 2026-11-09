import { createStore, produce } from "solid-js/store";

import { type Client, withoutNull } from "@zrzur/sdk/solid";

import { InteractionError, interactionApi, nonce } from "./api";
import { dmCommands } from "./commandList";
import {
  EPHEMERAL_LIFETIME_MS,
  ephemeralExpiry,
  ephemeralKey,
  ephemeralStorage,
  takeStoredEphemeral,
} from "./ephemeralStorage";
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
import { isInteractionEvent } from "./types";

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
  /** Why a button or menu just failed, shown next to it, by `messageId:customId` */
  componentErrors: Record<string, string>;
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
  componentErrors: {},
  commands: {},
  labels: {},
});

export { state as interactionState };

/** How long after the deadline we wait before calling it a timeout */
const GRACE_MS = 1500;

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
  const key = pending?.componentKey;
  setState(
    produce((draft) => {
      if (key) {
        delete draft.busy[key];
        // shown at the button or menu that was used
        draft.componentErrors[key] = error;
      }
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
    if (key && state.componentErrors[key] === error) {
      setState(
        produce((draft) => {
          delete draft.componentErrors[key];
        }),
      );
    }
  }, 8000);
}

/** Keep this tab's private answers for a reload */
function saveEphemeral() {
  if (!ephemeralOwner) return;
  try {
    ephemeralStorage()?.setItem(
      ephemeralKey(ephemeralOwner),
      JSON.stringify(state.ephemeral),
    );
  } catch {
    // full or blocked storage: they just do not survive a reload
  }
}

/** Remove a private answer when its token expires */
function expireLater(message: EphemeralMessage) {
  const expiry = ephemeralExpiry(message) ?? Date.now() + EPHEMERAL_LIFETIME_MS;
  setTimeout(
    () => dismissEphemeral(message.channel_id, message._id),
    Math.max(expiry - Date.now(), 0),
  );
}
/** The account whose private answers are in memory */
let ephemeralOwner: string | undefined;

/**
 * Private answers of this tab survive a reload until they expire, for the
 * account that received them only: another account signing in starts empty
 * and the old answers are removed.
 */
export function useEphemeralFor(userId: string | undefined) {
  if (!userId || userId === ephemeralOwner) return;
  ephemeralOwner = userId;
  const restored = takeStoredEphemeral(ephemeralStorage(), userId, Date.now());
  setState(
    produce((draft) => {
      draft.ephemeral = restored;
    }),
  );
  for (const list of Object.values(restored)) list.forEach(expireLater);
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
  saveEphemeral();
  expireLater(message);
}

export function dismissEphemeral(channelId: string, messageId: string) {
  setState(
    produce((draft) => {
      const list = draft.ephemeral[channelId];
      if (list) {
        const left = list.filter((m) => m._id !== messageId);
        if (left.length) draft.ephemeral[channelId] = left;
        else delete draft.ephemeral[channelId];
      }
    }),
  );
  saveEphemeral();
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
    case "ApplicationCommandsUpdate": {
      // the server's lists (whole and per channel) and, as a bot's global
      // commands may have changed, the DM lists load again; answers still
      // on their way are dropped (see `loadInto`)
      const stale = (key: string) =>
        key === event.server_id ||
        key.startsWith(`${event.server_id}#`) ||
        key.startsWith("dm:");
      const keys = new Set([
        ...Object.keys(state.commands),
        ...commandRequests.keys(),
      ]);
      for (const key of keys) {
        if (!stale(key)) continue;
        commandRequests.delete(key);
        generations.set(key, (generations.get(key) ?? 0) + 1);
        setState(
          produce((draft) => {
            delete draft.commands[key];
          }),
        );
      }
      break;
    }
  }
}

/** Listen to the gateway once per client */
export function attachInteractions(client: Client) {
  useEphemeralFor(client.user?.id);
  if (attached.has(client)) return;
  attached.add(client);
  client.events.on("event", (event) => {
    if (isInteractionEvent(event)) onEvent(withoutNull(event));
  });
}

/**
 * Where a channel's commands come from: its server, asked for this channel
 * so the server's channel rules apply (`<server>#<channel>`), or the bot of a
 * DM with a bot (`dm:<bot id>`). Nothing for groups and DMs with people.
 */
export function commandsKey(channel: {
  id: string;
  type: string;
  serverId?: string;
  /** The channel a thread or forum post is in */
  parentId?: string;
  recipient?: { id: string; bot?: unknown };
}): string | undefined {
  // a thread follows the rules of its channel, as the server does
  if (channel.type === "TextChannel" && channel.serverId)
    return `${channel.serverId}#${channel.parentId ?? channel.id}`;
  if (channel.type === "DirectMessage" && channel.recipient?.bot)
    return `dm:${channel.recipient.id}`;
  return undefined;
}

/** Load the commands for a key from `commandsKey` */
export function loadCommands(client: Client, key: string) {
  if (key.startsWith("dm:")) return loadDmCommands(client, key.slice(3));
  const [serverId, channelId] = key.split("#");
  return channelId
    ? loadChannelCommands(client, serverId, channelId)
    : loadServerCommands(client, serverId);
}

/** Bumped when a list goes stale, so an answer already on its way is dropped */
const generations = new Map<string, number>();

/** Fetch a list once per key until it changes; stale answers are not kept */
function loadInto(key: string, fetch: () => Promise<ServerCommands>) {
  if (state.commands[key]) return Promise.resolve(state.commands[key]);
  let request = commandRequests.get(key);
  if (!request) {
    const generation = generations.get(key) ?? 0;
    request = fetch().then((commands) => {
      if ((generations.get(key) ?? 0) === generation) {
        setState("commands", key, commands);
      }
      return commands;
    });
    request.catch(() => {
      if (commandRequests.get(key) === request) commandRequests.delete(key);
    });
    commandRequests.set(key, request);
  }
  return request;
}

/** The commands this member may use in one channel of a server */
export function loadChannelCommands(
  client: Client,
  serverId: string,
  channelId: string,
) {
  return loadInto(`${serverId}#${channelId}`, () =>
    interactionApi.serverCommands(client, serverId, channelId),
  );
}

/** A bot's global commands for the DM with it, fetched once until they change */
export function loadDmCommands(client: Client, botId: string) {
  return loadInto(`dm:${botId}`, () =>
    interactionApi.botCommands(client, botId).then((commands) => {
      const user = client.users.get(botId);
      return dmCommands(
        {
          _id: botId,
          username: user?.username ?? "",
          display_name: user?.displayName,
        },
        commands,
      );
    }),
  );
}

/** Commands of the bots installed in a server, fetched once until they change */
export function loadServerCommands(client: Client, serverId: string) {
  return loadInto(serverId, () =>
    interactionApi.serverCommands(client, serverId),
  );
}

async function start(
  client: Client,
  data: CreateInteraction,
  extra: { label?: string; componentKey?: string },
) {
  if (extra.componentKey) {
    setState("busy", extra.componentKey, true);
    // a new try clears the last error
    setState(
      produce((draft) => {
        delete draft.componentErrors[extra.componentKey!];
      }),
    );
  }
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
      componentKey: extra.componentKey,
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

/** The bot did not send suggestions in time */
export class AutocompleteTimeout extends Error {
  constructor() {
    super("The bot did not answer");
    this.name = "AutocompleteTimeout";
  }
}

/**
 * Ask the bot for suggestions. Resolves with no choices when `signal`
 * aborts (a newer keystroke); rejects with `AutocompleteTimeout` when the
 * bot does not answer in time, so "no matches" and "no answer" differ.
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      autocompleteWaiters.delete(accepted._id);
      reject(new AutocompleteTimeout());
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
