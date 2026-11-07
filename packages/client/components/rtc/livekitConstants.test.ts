import { ConnectionState, Track } from "livekit-client";
import { describe, expect, it } from "vitest";

import { RoomState, TrackKind, TrackSource } from "./livekitConstants";

describe("LiveKit values used before the library loads", () => {
  it("match livekit-client", () => {
    expect(TrackSource).toEqual({ ...Track.Source });
    expect(TrackKind).toEqual({ ...Track.Kind });
    expect(RoomState).toEqual({ ...ConnectionState });
  });
});
