// The voice components (solid-livekit-components) came from React, where an
// effect returns its cleanup. In Solid that return value is not a cleanup:
// subscriptions stayed and tracks stayed attached to their <video> after a
// call, which kept every call's room in memory. These tests hold the hooks
// to Solid's onCleanup.
import { createRoot, createSignal } from "solid-js";

import { describe, expect, it, vi } from "vitest";

const observable = vi.hoisted(() => {
  const state = { subscribed: 0, unsubscribed: 0 };
  return {
    state,
    make: () => ({
      subscribe: () => {
        state.subscribed++;
        return { unsubscribe: () => void state.unsubscribed++ };
      },
    }),
  };
});
const track = vi.hoisted(() => ({
  kind: "video",
  attach: vi.fn(),
  detach: vi.fn(),
}));

vi.mock("@livekit/components-core", async (original) => ({
  ...(await original<typeof import("@livekit/components-core")>()),
  trackReferencesObservable: () => observable.make(),
  mutedObserver: () => observable.make(),
  setupMediaTrack: () => ({
    className: "lk-participant-media-video",
    trackObserver: observable.make(),
  }),
  getTrackByIdentifier: () => ({ track, isMuted: false, isSubscribed: true }),
  isLocal: () => false,
}));

import { useObservableState } from "../../../solid-livekit-components/src/signals/internal/useObservableState";
import { useIsMuted } from "../../../solid-livekit-components/src/signals/useIsMuted";
import { useMediaTrackBySourceOrName } from "../../../solid-livekit-components/src/signals/useMediaTrackBySourceOrName";
import { useTracks } from "../../../solid-livekit-components/src/signals/useTracks";

const participant = {
  sid: "PA_1",
  identity: "user",
  isLocal: false,
  getTrackPublication: () => undefined,
};

/** Run a hook in its own root, let its effects run, then dispose the root */
async function mountAndDispose(hook: () => void) {
  observable.state.subscribed = 0;
  observable.state.unsubscribed = 0;
  const dispose = createRoot((dispose) => {
    hook();
    return dispose;
  });
  await Promise.resolve();
  const subscribed = observable.state.subscribed;
  expect(observable.state.unsubscribed).toBe(0);
  dispose();
  return subscribed;
}

describe("voice component hooks let go when their component goes", () => {
  it("useObservableState unsubscribes", async () => {
    const subscribed = await mountAndDispose(() =>
      useObservableState(observable.make() as never, 0),
    );
    expect(subscribed).toBe(1);
    expect(observable.state.unsubscribed).toBe(1);
  });

  it("useTracks unsubscribes from the room", async () => {
    const subscribed = await mountAndDispose(() =>
      useTracks(["camera"] as never, { room: {} as never }),
    );
    expect(subscribed).toBe(1);
    expect(observable.state.unsubscribed).toBe(1);
  });

  it("useIsMuted unsubscribes", async () => {
    const subscribed = await mountAndDispose(() =>
      useIsMuted({ participant, source: "camera" } as never),
    );
    expect(subscribed).toBe(1);
    expect(observable.state.unsubscribed).toBe(1);
  });

  it("a media track is detached from its element and unsubscribed", async () => {
    track.attach.mockClear();
    track.detach.mockClear();
    const element = document.createElement("video");
    const subscribed = await mountAndDispose(() =>
      useMediaTrackBySourceOrName({ participant, source: "camera" } as never, {
        element: () => element,
      }),
    );
    expect(subscribed).toBe(1);
    expect(track.attach).toHaveBeenCalledWith(element);
    expect(observable.state.unsubscribed).toBe(1);
    expect(track.detach).toHaveBeenCalledWith(element);
  });

  it("a media track moves with its element: the old one is detached once", async () => {
    track.attach.mockClear();
    track.detach.mockClear();
    const first = document.createElement("video");
    const second = document.createElement("video");
    const [element, setElement] = createSignal(first);
    const dispose = createRoot((dispose) => {
      useMediaTrackBySourceOrName({ participant, source: "camera" } as never, {
        element,
      });
      return dispose;
    });
    await Promise.resolve();
    setElement(second);
    await Promise.resolve();
    expect(track.detach.mock.calls).toEqual([[first]]);
    expect(track.attach.mock.calls).toEqual([[first], [second]]);
    dispose();
    expect(track.detach.mock.calls).toEqual([[first], [second]]);
  });
});
