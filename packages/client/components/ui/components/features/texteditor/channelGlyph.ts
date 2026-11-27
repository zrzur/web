import type { Channel } from "@zrzur/sdk/solid";

import type { IconName } from "../../../icons/Icon";

/**
 * What kind of room a channel is, as one icon: the marks of the channel
 * list (# to write, a speaker to talk, a forum, announcements…), so a
 * suggestion tells a voice room from a text room at a glance. The same
 * icons, in the same order, as the channel list (ServerSidebar); "rules" is
 * the solid book of RulesIcon
 */
export function channelGlyph(
  channel: Pick<
    Channel,
    | "id"
    | "announcement"
    | "isForum"
    | "ticket"
    | "isRoomMaker"
    | "isVoice"
    | "isStage"
    | "voice"
  > & { server?: { rulesChannelId?: string } },
): IconName | "rules" {
  if (channel.server?.rulesChannelId === channel.id) return "rules";
  if (channel.announcement) return "megaphone";
  if (channel.isForum) return "note-pencil";
  if (channel.ticket) return "ticket";
  if (channel.isRoomMaker) return "speaker-plus";
  if (channel.voice?.locked) return "lock-simple";
  if (channel.isVoice) return channel.isStage ? "waveform" : "speaker-high";
  return "hash";
}
