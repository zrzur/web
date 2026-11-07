import type { Channel } from "@zrzur/sdk/solid";

/**
 * What someone can do with threads and forum posts here. The server decides
 * (threads.rs); this only keeps the app from offering what it would refuse.
 * - `switched-off`: the server has the feature off; existing content is
 *   read-only for everyone, the owner too
 * - `no-permission`: a permission on the channel doesn't let this person
 */
export type ThreadAccess = "allowed" | "switched-off" | "no-permission";

/** The parts of a channel this looks at */
export type ThreadChannel = Pick<Channel, "isForum" | "havePermission"> & {
  parent?: Pick<Channel, "isForum">;
  server?: Pick<
    NonNullable<Channel["server"]>,
    "threadsDisabled" | "forumsDisabled"
  >;
};

function isSwitchedOff(channel: ThreadChannel, forum: boolean) {
  return forum
    ? !!channel.server?.forumsDisabled
    : !!channel.server?.threadsDisabled;
}

/** Starting a thread in a text channel, or a post in a forum */
export function startAccess(channel: ThreadChannel): ThreadAccess {
  if (isSwitchedOff(channel, channel.isForum)) return "switched-off";
  return channel.havePermission(
    "SendMessage",
    channel.isForum ? "CreateForumPosts" : "CreateThreads",
  )
    ? "allowed"
    : "no-permission";
}

/** Writing in a thread or forum post; `channel` is the thread */
export function writeAccess(channel: ThreadChannel): ThreadAccess {
  if (isSwitchedOff(channel, !!channel.parent?.isForum)) return "switched-off";
  return channel.havePermission("SendMessage", "SendMessageInThreads")
    ? "allowed"
    : "no-permission";
}

/** Sending or editing a message here, in a thread or a plain channel */
export function canSend(channel: ThreadChannel & { isThread: boolean }) {
  return channel.isThread
    ? writeAccess(channel) === "allowed"
    : channel.havePermission("SendMessage");
}

/** A thread or post whose feature is off takes no reactions either */
export function threadIsReadOnly(
  channel: ThreadChannel & { isThread: boolean },
) {
  return channel.isThread && writeAccess(channel) === "switched-off";
}
