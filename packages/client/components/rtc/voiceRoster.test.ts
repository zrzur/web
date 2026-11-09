/**
 * Who is in a voice room, as the app learns it from the gateway (owner
 * report 2026-11-09: "people in a voice room are not shown to others").
 * Drives the real SDK client with the events in the orders a reload, a join
 * and a gateway reconnect produce, and reads `channel.voiceParticipants`,
 * which the channel list (VoiceChannelPreview) renders.
 */
import { Client } from "@zrzur/sdk/solid";
import { afterEach, describe, expect, it, vi } from "vitest";

const ID = (n: string) => `01ARZ3NDEKTSV4RRFFQ69G5F${n}`;
const ME = ID("AA");
const ALI = ID("BB");
const SAM = ID("CC");
const SERVER = ID("SV");
const VOICE = ID("V1");

const state = (id: string) => ({
  id,
  joined_at: "2026-11-09T20:00:00Z",
  is_receiving: true,
  is_publishing: true,
  screensharing: false,
  camera: false,
});

const ready = (participants: string[] | undefined) => ({
  type: "Ready",
  users: [
    { _id: ME, username: "me", discriminator: "0001", relationship: "User" },
    { _id: ALI, username: "ali", discriminator: "0002", relationship: "None" },
    { _id: SAM, username: "sam", discriminator: "0003", relationship: "None" },
  ],
  servers: [
    {
      _id: SERVER,
      owner: ME,
      name: "S",
      channels: [VOICE],
      default_permissions: 0,
    },
  ],
  channels: [
    {
      channel_type: "TextChannel",
      _id: VOICE,
      server: SERVER,
      name: "Lounge",
      voice: {},
    },
  ],
  members: [],
  emojis: [],
  voice_states:
    participants === undefined
      ? []
      : [{ id: VOICE, participants: participants.map(state) }],
});

let client: Client | undefined;
afterEach(() => {
  client = undefined;
  vi.restoreAllMocks();
});

async function send(event: unknown) {
  await client!.events.emit("event", event as never);
}
const roster = () =>
  [...client!.channels.get(VOICE)!.voiceParticipants.keys()].sort();

async function connect(participants: string[] | undefined) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 200 }),
  );
  client = new Client({
    baseURL: "http://localhost:1",
    autoReconnect: false,
  } as never);
  await send(ready(participants));
}

describe("voice room roster", () => {
  it("after a reload, shows everyone the server lists in Ready", async () => {
    await connect([ALI, SAM]);
    expect(roster()).toEqual([ALI, SAM].sort());
  });

  it("adds people who join and removes people who leave", async () => {
    await connect([ALI]);
    await send({ type: "VoiceChannelJoin", id: VOICE, state: state(SAM) });
    expect(roster()).toEqual([ALI, SAM].sort());
    await send({ type: "VoiceChannelLeave", id: VOICE, user: ALI });
    expect(roster()).toEqual([SAM]);
  });

  it("someone moved in from another room appears", async () => {
    await connect([]);
    await send({
      type: "VoiceChannelMove",
      user: SAM,
      from: ID("V0"),
      to: VOICE,
      state: state(SAM),
    });
    expect(roster()).toEqual([SAM]);
  });

  it("a gateway reconnect keeps people who joined while it was down", async () => {
    await connect([ALI]);
    // SAM joined during the drop: the join event was lost, the new Ready
    // carries the room as the server has it now
    await send(ready([ALI, SAM]));
    expect(roster()).toEqual([ALI, SAM].sort());
  });

  it("a join that arrives before Ready is kept when Ready lists it", async () => {
    await connect(undefined);
    await send({ type: "VoiceChannelJoin", id: VOICE, state: state(ALI) });
    await send(ready([ALI]));
    expect(roster()).toEqual([ALI]);
  });

  // Found on the way (it showed too many people, not too few): Ready only
  // rewrote rooms it listed, so people who left during a gateway drop stayed.
  // Fixed in the SDK (src/solid/events/v1.ts, Ready, `voice_states`).
  it(
    "a reconnect clears a room that emptied while it was down",
    async () => {
      await connect([ALI]);
      await send(ready(undefined));
      expect(roster()).toEqual([]);
    },
  );
});
