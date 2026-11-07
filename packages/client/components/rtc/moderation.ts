import type { Channel, ServerMember } from "@zrzur/sdk/solid";

/** Match member-edit's server permission and strict rank checks. */
export function voiceModeration(channel: Channel, target?: ServerMember) {
  const server = channel.server;
  const actor = server?.member;
  const elevated =
    !!server &&
    !!actor &&
    !!target &&
    actor.id.user !== target.id.user &&
    (actor.id.user === server.ownerId ||
      (target.id.user !== server.ownerId && actor.ranking < target.ranking));
  const present = !!target && channel.voiceParticipants.has(target.id.user);
  return {
    mute: elevated && present && !!server?.havePermission("MuteMembers"),
    deafen: elevated && present && !!server?.havePermission("DeafenMembers"),
    // Moving is checked in the channel, so overrides can grant or deny it.
    move: elevated && present && !!channel.havePermission("MoveMembers"),
  };
}

/** Voice channels the actor may move the target into (Move Members on both ends). */
export function voiceDestinations(channel: Channel, target?: ServerMember) {
  return (channel.server?.channels ?? []).filter((destination) =>
    canMoveInto(channel, destination, target),
  );
}

function canMoveInto(
  source: Channel,
  destination: Channel,
  target?: ServerMember,
) {
  return (
    destination.id !== source.id &&
    destination.isVoice &&
    destination.serverId === source.serverId &&
    destination.havePermission("ViewChannel", "Connect", "MoveMembers") &&
    !!target?.hasPermission(destination, "ViewChannel", "Connect")
  );
}

/**
 * Whether a dragged participant may be dropped on a voice channel. The server
 * repeats every check; a full room only takes them when the actor may
 * exceed its limit.
 */
export function canDropVoiceParticipant(
  source: Channel,
  destination: Channel,
  target?: ServerMember,
) {
  return (
    voiceModeration(source, target).move &&
    canMoveInto(source, destination, target) &&
    (!voiceOccupancy(destination).full ||
      destination.havePermission("ManageChannel"))
  );
}

export function voiceOccupancy(channel: Channel) {
  const count = channel.voiceParticipants.size;
  const maximum = channel.voice?.maxUsers;
  return { count, maximum, full: maximum !== undefined && count >= maximum };
}

/**
 * Highest user limit the channel settings slider offers. Start at 50 while
 * the voice server's capacity is proven, then raise (e.g. to 100).
 */
export const MAX_VOICE_USER_LIMIT = 50;

export function parseUserLimit(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1
  ) {
    throw new Error("Invalid voice user limit");
  }
  return Number(value);
}

export function voiceErrorType(error: unknown): string {
  if (typeof error === "string") {
    try {
      return voiceErrorType(JSON.parse(error));
    } catch {
      return /429|Too Many Requests/.test(error)
        ? "RateLimited"
        : "NetworkError";
    }
  }
  if (typeof error !== "object" || error === null) return "NetworkError";
  const data = error as {
    code?: number;
    retry_after?: number;
    type?: string;
    response?: { data?: { type?: string } };
    name?: string;
  };
  if (data.code === 429 || (data.retry_after !== undefined && !data.type))
    return "RateLimited";
  return data.type ?? data.response?.data?.type ?? data.name ?? "NetworkError";
}
