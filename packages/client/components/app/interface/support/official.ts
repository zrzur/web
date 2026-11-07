import type { Channel } from "@zrzur/sdk/solid";

/** Whether a channel is the private conversation with an official account */
export const isOfficialChannel = (channel?: Channel) =>
  channel?.type === "DirectMessage" && !!channel.recipient?.official;
