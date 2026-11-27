import { createEffect, createRoot, createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createCallTracks } from "./callFocus";

type Track = { id: string };
const idOf = (track: Track) => track.id;

/** A room's track list, as LiveKit's useTracks gives it */
function room(...ids: string[]) {
  const [tracks, setTracks] = createSignal<Track[]>(ids.map((id) => ({ id })));
  return {
    tracks,
    set: (...next: string[]) => setTracks(next.map((id) => ({ id }))),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe("the focused track of a call", () => {
  it("ends when the share stops: the stage goes back to everyone", () => {
    createRoot((dispose) => {
      const call = createCallTracks(idOf);
      const first = room("camera_a", "screen_share_b");
      call.setSource(first.tracks);
      call.setFocus("screen_share_b");
      expect(call.focus()).toBe("screen_share_b");

      first.set("camera_a", "camera_b");
      expect(call.focus()).toBeUndefined();
      dispose();
    });
  });

  it("follows the list of a later connection (a reconnect), not the first one", async () => {
    const seen: number[] = [];
    const dispose = createRoot((dispose) => {
      const call = createCallTracks(idOf);
      createEffect(() => seen.push(call.tracks().length));
      const first = room("camera_a");
      call.setSource(first.tracks);
      const second = room("camera_a", "screen_share_b");
      call.setSource(second.tracks);
      call.setFocus("screen_share_b");
      // the share of the new connection stops
      second.set("camera_a");
      expect(call.focus()).toBeUndefined();
      return dispose;
    });
    await flush();
    // what read the tracks saw the new connection's lists
    expect(seen.at(-1)).toBe(1);
    dispose();
  });

  it("is forgotten once it ended: sharing again later does not take the stage", async () => {
    const ended = vi.fn();
    let call!: ReturnType<typeof createCallTracks<Track>>;
    let list!: ReturnType<typeof room>;
    const dispose = createRoot((dispose) => {
      call = createCallTracks(idOf);
      list = room("camera_a", "screen_share_b");
      call.setSource(list.tracks);
      call.forgetEnded(ended);
      call.setFocus("screen_share_b");
      return dispose;
    });
    await flush();
    list.set("camera_a");
    await flush();
    expect(ended).toHaveBeenCalledTimes(1);

    list.set("camera_a", "screen_share_b");
    expect(call.focus()).toBeUndefined();
    dispose();
  });

  it("stays on a track that is still there", () => {
    createRoot((dispose) => {
      const call = createCallTracks(idOf);
      const list = room("camera_a", "screen_share_b");
      call.setSource(list.tracks);
      call.setFocus("screen_share_b");
      list.set("camera_a", "screen_share_b", "camera_c");
      expect(call.focus()).toBe("screen_share_b");
      dispose();
    });
  });
});
