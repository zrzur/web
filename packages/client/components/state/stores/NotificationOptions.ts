import { Accessor, createMemo } from "solid-js";

import { Channel, Message, Server } from "@zrzur/sdk/solid";

import { AbstractSyncedStore } from ".";
import { State } from "..";

import {
  type NotificationState,
  effectiveServerState,
  effectiveSuppress,
  mentionsForNotification,
} from "./notificationLevels";

export type { NotificationState };

/** What a suppress option hides from notifications */
export type SuppressKind = "everyone" | "roles";

/**
 * Possible notification states
 */
const NotificationStates: NotificationState[] = ["all", "mention", "none"];

/**
 * Default notification states for various types of channels
 */
export const DEFAULT_STATES: {
  [key in Channel["type"]]: NotificationState;
} = {
  SavedMessages: "all",
  DirectMessage: "all",
  Group: "all",
  TextChannel: undefined!,
};

/**
 * Default state for servers
 */
export const DEFAULT_SERVER_STATE: NotificationState = "mention";

export interface MuteState {
  until?: number;
}

export interface TypeNotificationOptions {
  /**
   * Per-server settings
   */
  server: Record<string, NotificationState | undefined>;

  /**
   * Per-channel settings
   */
  channel: Record<string, NotificationState | undefined>;

  /**
   * Server mute settings
   */
  server_mutes: Record<string, MuteState | undefined>;

  /**
   * Channel mute settings
   */
  channel_mutes: Record<string, MuteState | undefined>;

  /**
   * Suppress @everyone and @here, by server or channel id
   */
  suppress_everyone: Record<string, boolean | undefined>;

  /**
   * Suppress role mentions, by server or channel id
   */
  suppress_roles: Record<string, boolean | undefined>;
}

/**
 * Manages the user's notification preferences.
 */
export class NotificationOptions extends AbstractSyncedStore<
  "notifications",
  TypeNotificationOptions
> {
  #now: Accessor<number>;

  /**
   * Construct new Experiments store.
   */
  constructor(state: State) {
    super(state, "notifications");

    // update every minute
    this.#now = createMemo(() => +state.datePerMinute());
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    /** nothing needs to be done */
  }

  /**
   * Generate default values
   */
  default(): TypeNotificationOptions {
    return {
      server: {},
      channel: {},
      server_mutes: {},
      channel_mutes: {},
      suppress_everyone: {},
      suppress_roles: {},
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeNotificationOptions>): TypeNotificationOptions {
    const server: TypeNotificationOptions["server"] = {};
    const channel: TypeNotificationOptions["channel"] = {};
    const server_mutes: TypeNotificationOptions["server_mutes"] = {};
    const channel_mutes: TypeNotificationOptions["channel_mutes"] = {};

    if (typeof input.server === "object") {
      for (const serverId of Object.keys(input.server)) {
        const entry = input.server[serverId];

        // migrate legacy muted channels to new dict.
        if ((entry as unknown) === "muted") {
          server_mutes[serverId] = {};
        }

        if (entry && NotificationStates.includes(entry)) {
          server[serverId] = entry;
        }
      }
    }

    if (typeof input.channel === "object") {
      for (const channelId of Object.keys(input.channel)) {
        const entry = input.channel[channelId];

        // migrate legacy muted channels to new dict.
        if ((entry as unknown) === "muted") {
          channel_mutes[channelId] = {};
        }

        if (entry && NotificationStates.includes(entry)) {
          channel[channelId] = entry;
        }
      }
    }

    const now = +new Date();

    const suppress_everyone = cleanFlags(input.suppress_everyone);
    const suppress_roles = cleanFlags(input.suppress_roles);

    if (typeof input.server_mutes === "object") {
      for (const serverId of Object.keys(input.server_mutes)) {
        const entry = input.server_mutes[serverId];
        if (
          entry &&
          (typeof entry.until === "undefined" ||
            (typeof entry.until === "number" && entry.until > now))
        ) {
          server_mutes[serverId] = { until: entry.until };
        }
      }
    }

    if (typeof input.channel_mutes === "object") {
      for (const channelId of Object.keys(input.channel_mutes)) {
        const entry = input.channel_mutes[channelId];
        if (
          entry &&
          (typeof entry.until === "undefined" ||
            (typeof entry.until === "number" && entry.until > now))
        ) {
          channel_mutes[channelId] = { until: entry.until };
        }
      }
    }

    return {
      server,
      channel,
      server_mutes,
      channel_mutes,
      suppress_everyone,
      suppress_roles,
    };
  }

  /**
   * Compute the notification state for a given Server
   * @param server Server
   * @returns Notification state
   */
  computeForServer(server?: Server) {
    return server
      ? effectiveServerState(
          this.get().server[server.id],
          server.defaultNotifications,
        )
      : undefined;
  }

  /**
   * The member's own choice for a server, if any
   * @param server Server
   */
  getServer(server: Server) {
    return this.get().server[server.id];
  }

  /**
   * Own suppress choice for a server or channel (undefined = inherit)
   * @param kind What is suppressed
   * @param target Server or channel
   */
  getSuppress(kind: SuppressKind, target: Server | Channel) {
    return this.get()[`suppress_${kind}`][target.id];
  }

  /**
   * Set a suppress choice for a server or channel (undefined = inherit)
   * @param kind What is suppressed
   * @param target Server or channel
   * @param value Choice
   */
  setSuppress(
    kind: SuppressKind,
    target: Server | Channel,
    value: boolean | undefined,
  ) {
    this.set(`suppress_${kind}`, target.id, value);
  }

  /**
   * Whether a suppress option is on for a channel (inherits its server)
   * @param kind What is suppressed
   * @param channel Channel
   */
  isSuppressed(kind: SuppressKind, channel: Channel): boolean {
    const values = this.get()[`suppress_${kind}`];
    return effectiveSuppress(
      values[channel.id],
      channel.serverId ? values[channel.serverId] : undefined,
    );
  }

  /**
   * Whether a message mentions us, after our suppress options
   * @param message Message
   * @param selfId Our user id
   */
  mentionsForNotification(message: Message, selfId: string | undefined) {
    const channel = message.channel;
    return mentionsForNotification({
      selfId,
      mentionIds: message.mentionIds,
      flags: message.flags,
      mentionsMyRole: !!message.roleMentions?.some((role) => role.assigned),
      suppressEveryone: channel
        ? this.isSuppressed("everyone", channel)
        : false,
      suppressRoles: channel ? this.isSuppressed("roles", channel) : false,
    });
  }

  /**
   * Compute the actual notification state for a given Channel
   * @param channel Channel
   * @returns Notification state
   */
  computeForChannel(channel: Channel) {
    return (
      this.get().channel[channel.id] ??
      this.computeForServer(channel.server) ??
      DEFAULT_STATES[channel.type]
    );
  }

  /**
   * Set notification state for a server
   * @param server Server
   * @param state State
   */
  setServer(server: Server, state: NotificationState | undefined) {
    this.set("server", server.id, state);
  }

  /**
   * Set mute state for a server
   * @param server Server
   * @param state State
   */
  setServerMute(server: Server, state: MuteState | undefined) {
    this.set("server_mutes", server.id, state);
  }

  /**
   * Get muted state for a server
   * @param server Server
   * @returns Current state
   */
  getServerMute(server: Server) {
    return this.get().server_mutes[server.id];
  }

  /**
   * Set notification state for a channel
   * @param channel Channel
   * @param state State
   */
  setChannel(channel: Channel, state: NotificationState | undefined) {
    this.set("channel", channel.id, state);
  }

  /**
   * Set mute state for a channel
   * @param channel Channel
   * @param state State
   */
  setChannelMute(channel: Channel, state: MuteState | undefined) {
    this.set("channel_mutes", channel.id, state);
  }

  /**
   * Get notification state for a channel
   * @param channel Channel
   * @returns Current state
   */
  getChannel(channel: Channel) {
    return this.get().channel[channel.id];
  }

  /**
   * Get muted state for a channel
   * @param channel Channel
   * @returns Current state
   */
  getChannelMute(channel: Channel) {
    return this.get().channel_mutes[channel.id];
  }

  /**
   * Check whether a Channel or Server is muted (channel will inherit server)
   * @param target Channel or Server
   * @returns Whether this object is muted
   */
  isMuted(target?: Channel | Server): boolean {
    let value: MuteState | undefined;
    if (target instanceof Channel) {
      if (this.isMuted(target.server)) return true;
      value = this.get().channel_mutes[target.id];
    } else if (target instanceof Server) {
      value = this.get().server_mutes[target.id];
    }

    return !!value && (!value.until || value.until > this.#now());
  }

  /**
   * Check whether a Channel is muted (ignoring server)
   * @param channel Channel
   * @returns Whether this channel is muted
   */
  isChannelMuted(channel: Channel): boolean {
    const value = this.get().channel_mutes[channel.id];
    return !!value && (!value.until || value.until > this.#now());
  }
}

/**
 * Keep only true/false entries of a suppress map
 */
function cleanFlags(
  input: Record<string, boolean | undefined> | undefined,
): Record<string, boolean | undefined> {
  const out: Record<string, boolean | undefined> = {};
  if (typeof input === "object" && input) {
    for (const id of Object.keys(input)) {
      if (typeof input[id] === "boolean") out[id] = input[id];
    }
  }
  return out;
}
