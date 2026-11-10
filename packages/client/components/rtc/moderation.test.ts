import type { Channel, ServerMember } from "@zrzur/sdk/solid";
import { describe, expect, it } from "vitest";
import {
  canDropVoiceParticipant,
  parseUserLimit,
  userLimitChange,
  voiceDestinations,
  voiceErrorType,
  voiceModeration,
  voiceOccupancy,
} from "./moderation";

function fixture(actorRank = 2, targetRank = 5) {
  const grants = new Set<string>();
  const actor = { id: { user: "actor" }, ranking: actorRank };
  const target = {
    id: { user: "target" },
    ranking: targetRank,
  } as ServerMember;
  const server = {
    ownerId: "owner",
    member: actor,
    havePermission: (permission: string) => grants.has(permission),
    channels: [] as Channel[],
  };
  const channel = {
    id: "source",
    serverId: "server",
    server,
    havePermission: (...permissions: string[]) =>
      permissions.every((permission) => grants.has(permission)),
    voiceParticipants: new Map([["target", {}]]),
  } as unknown as Channel;
  return { channel, server, target, actor, grants };
}

describe("voice moderation authorization", () => {
  it("ordinary members have no management actions", () => {
    const { channel, target } = fixture();
    expect(voiceModeration(channel, target)).toEqual({
      mute: false,
      deafen: false,
      move: false,
    });
  });
  it("requires each real server permission independently", () => {
    const { channel, target, grants } = fixture();
    grants.add("MuteMembers");
    expect(voiceModeration(channel, target)).toEqual({
      mute: true,
      deafen: false,
      move: false,
    });
  });
  it.each([
    [2, 2],
    [5, 2],
    [Infinity, Infinity],
  ])("blocks equal or higher roles (%s, %s)", (actor, target) => {
    const f = fixture(actor, target);
    f.grants.add("MoveMembers");
    expect(voiceModeration(f.channel, f.target).move).toBe(false);
  });
  it("protects owner and rejects self-moderation", () => {
    const f = fixture();
    f.grants.add("MuteMembers");
    f.server.ownerId = "target";
    expect(voiceModeration(f.channel, f.target).mute).toBe(false);
    f.actor.id.user = "target";
    expect(voiceModeration(f.channel, f.target).mute).toBe(false);
  });
  it("owner may moderate other members but only while present", () => {
    const f = fixture(5, 2);
    f.server.ownerId = "actor";
    f.grants.add("MoveMembers");
    expect(voiceModeration(f.channel, f.target).move).toBe(true);
    f.channel.voiceParticipants.clear();
    expect(voiceModeration(f.channel, f.target).move).toBe(false);
  });
  it("missing member data fails closed", () => {
    const f = fixture();
    f.grants.add("MuteMembers");
    expect(voiceModeration(f.channel).mute).toBe(false);
  });
  it("destinations require voice and actor/target access", () => {
    const f = fixture();
    f.server.channels = [
      {
        id: "text",
        serverId: "server",
        isVoice: false,
        havePermission: () => true,
      },
      {
        id: "source",
        serverId: "server",
        isVoice: true,
        havePermission: () => true,
      },
      {
        id: "hidden",
        serverId: "server",
        isVoice: true,
        havePermission: () => false,
      },
      {
        id: "target-denied",
        serverId: "server",
        isVoice: true,
        havePermission: () => true,
      },
      {
        id: "allowed",
        serverId: "server",
        isVoice: true,
        havePermission: () => true,
      },
    ] as unknown as Channel[];
    const target = {
      hasPermission: (channel: Channel) => channel.id === "allowed",
    } as ServerMember;
    expect(
      voiceDestinations(f.channel, target).map((channel) => channel.id),
    ).toEqual(["allowed"]);
  });
});

describe("dragging voice participants", () => {
  const destination = (
    granted: string[],
    extra: Partial<Record<string, unknown>> = {},
  ) =>
    ({
      id: "destination",
      serverId: "server",
      isVoice: true,
      voiceParticipants: new Map(),
      havePermission: (...permissions: string[]) =>
        permissions.every((permission) => granted.includes(permission)),
      ...extra,
    }) as unknown as Channel;
  const reachable = {
    id: { user: "target" },
    ranking: 5,
    hasPermission: () => true,
  } as unknown as ServerMember;
  const all = ["ViewChannel", "Connect", "MoveMembers"];

  it("needs Move Members in the source channel", () => {
    const f = fixture();
    expect(
      canDropVoiceParticipant(f.channel, destination(all), reachable),
    ).toBe(false);
    f.grants.add("MoveMembers");
    expect(
      canDropVoiceParticipant(f.channel, destination(all), reachable),
    ).toBe(true);
  });
  it("needs Move Members and Connect in the target channel", () => {
    const f = fixture();
    f.grants.add("MoveMembers");
    expect(
      canDropVoiceParticipant(
        f.channel,
        destination(["ViewChannel", "Connect"]),
        reachable,
      ),
    ).toBe(false);
    expect(
      canDropVoiceParticipant(
        f.channel,
        destination(["ViewChannel", "MoveMembers"]),
        reachable,
      ),
    ).toBe(false);
  });
  it("rejects the same channel, other servers and full rooms", () => {
    const f = fixture();
    f.grants.add("MoveMembers");
    expect(canDropVoiceParticipant(f.channel, f.channel, reachable)).toBe(
      false,
    );
    expect(
      canDropVoiceParticipant(
        f.channel,
        destination(all, { serverId: "elsewhere" }),
        reachable,
      ),
    ).toBe(false);
    const full = {
      voice: { maxUsers: 1 },
      voiceParticipants: new Map([["someone", {}]]),
    };
    expect(
      canDropVoiceParticipant(f.channel, destination(all, full), reachable),
    ).toBe(false);
    expect(
      canDropVoiceParticipant(
        f.channel,
        destination([...all, "ManageChannel"], full),
        reachable,
      ),
    ).toBe(true);
  });
  it("needs the moved member to be allowed to connect", () => {
    const f = fixture();
    f.grants.add("MoveMembers");
    const blocked = { ...reachable, hasPermission: () => false };
    expect(
      canDropVoiceParticipant(
        f.channel,
        destination(all),
        blocked as unknown as ServerMember,
      ),
    ).toBe(false);
  });
});

describe("room capacity settings", () => {
  it("decodes raw SDK errors and rate-limit responses", () => {
    expect(voiceErrorType('{"type":"CannotJoinCall"}')).toBe("CannotJoinCall");
    expect(voiceErrorType('{"code":429,"reason":"Too Many Requests"}')).toBe(
      "RateLimited",
    );
    expect(voiceErrorType("not JSON")).toBe("NetworkError");
  });
  it("blank means unlimited; positive integer limits are retained", () => {
    expect(parseUserLimit("")).toBeUndefined();
    expect(parseUserLimit("5")).toBe(5);
  });
  it.each(["0", "-1", "1.5", "NaN", "Infinity", "1e3", "99999999999999999999"])(
    "rejects %s",
    (value) => expect(() => parseUserLimit(value)).toThrow(),
  );
  it("uses the authoritative roster and does not cap the displayed count", () => {
    const channel = {
      voice: { maxUsers: 1 },
      voiceParticipants: new Map([
        ["one", {}],
        ["two", {}],
      ]),
    } as unknown as Channel;
    expect(voiceOccupancy(channel)).toEqual({
      count: 2,
      maximum: 1,
      full: true,
    });
  });
});

describe("room size change", () => {
  it("sends 0 to take the limit away, which the API keeps otherwise", () => {
    expect(userLimitChange(5)).toEqual({ max_users: 5 });
    expect(userLimitChange(undefined)).toEqual({ max_users: 0 });
    expect(userLimitChange(null)).toEqual({ max_users: 0 });
    expect(userLimitChange(0)).toEqual({ max_users: 0 });
  });
});
