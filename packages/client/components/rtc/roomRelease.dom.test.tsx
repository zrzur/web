// LiveKit registers a device-change listener for every room it creates and
// means to let the room go through a weak reference. The listener and the
// clean-up it registers are made inside the room's constructor, so they
// hold the room after all: every call's room stayed in memory. With the
// registry off, LiveKit uses a plain listener, and removes it when the
// call ends.
import { Room } from "livekit-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { releaseRoomsOnDisconnect } from "./roomRelease";

const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const registry = Room.cleanupRegistry;

afterEach(() => {
  Room.cleanupRegistry = registry;
  if (original) Object.defineProperty(navigator, "mediaDevices", original);
  else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
});

function fakeMediaDevices() {
  const added: unknown[] = [];
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      addEventListener: (type: string, listener: unknown) =>
        void (type === "devicechange" && added.push(listener)),
      removeEventListener: vi.fn(),
      enumerateDevices: async () => [],
    },
  });
  return added;
}

describe("releaseRoomsOnDisconnect", () => {
  it("makes a room listen for devices with the listener LiveKit removes at the end of a call", () => {
    const added = fakeMediaDevices();
    releaseRoomsOnDisconnect(Room);

    const room = new Room();

    const removedOnDisconnect = (
      room as unknown as { handleDeviceChange: unknown }
    ).handleDeviceChange;
    expect(added).toEqual([removedOnDisconnect]);
  });

  it("registers nothing that would hold the room", () => {
    fakeMediaDevices();
    const register = vi.spyOn(FinalizationRegistry.prototype, "register");
    releaseRoomsOnDisconnect(Room);

    new Room();

    expect(register).not.toHaveBeenCalled();
    register.mockRestore();
  });
});
