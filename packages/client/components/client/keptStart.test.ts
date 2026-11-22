import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ClientController, { State, TransitionType } from "./Controller";

// A wide screen waits a moment for the server's first answer, then opens
// from what this device kept, so a slow line shows the lists instead of a
// loading screen. Phones open from it at once (unchanged).

vi.mock("./NotificationsController", () => ({
  killServiceWorkerSubscription: vi.fn(),
}));

let snapshotRead: { resolve: () => void } | undefined;
const restore = vi.fn(async (proceed?: () => boolean) => {
  await new Promise<void>((resolve) => (snapshotRead = { resolve }));
  if (proceed && !proceed()) return false;
  applied++;
  return true;
});
let applied = 0;

vi.mock("./offline", () => ({
  offlineDataFor: () => ({
    restoring: false,
    restore,
    keepState: vi.fn(),
    detach: vi.fn(),
  }),
  forgetOfflineData: vi.fn(() => Promise.resolve()),
}));

function fakeClient() {
  const clientListeners: Record<string, () => void> = {};
  return {
    options: {},
    user: undefined,
    events: { lastError: undefined, on: () => {}, off: () => {} },
    on: (name: string, fn: () => void) => {
      clientListeners[name] = fn;
    },
    ready: () => clientListeners.ready?.(),
    connect: vi.fn(),
    logout: vi.fn(() => Promise.resolve()),
    useExistingSession: vi.fn(),
    api: { get: vi.fn(() => Promise.resolve({ onboarding: false })) },
  };
}

function setup() {
  let client = fakeClient();
  const instance = {
    apiUrl: "http://127.0.0.1:14702",
    newClient: () => (client = fakeClient()),
  };
  const state = {
    auth: {
      getSession: () => undefined,
      markValid: vi.fn(),
      removeSession: vi.fn(),
      setName: vi.fn(),
    },
    notifications: { isMuted: () => false, isChannelMuted: () => false },
    settings: { resetNotificationsState: vi.fn() },
    draft: { flushOutbox: vi.fn(() => Promise.resolve()) },
  };
  const controller = new ClientController(
    state as unknown as ConstructorParameters<typeof ClientController>[0],
    instance as unknown as ConstructorParameters<typeof ClientController>[1],
  );
  controller.lifecycle.transition({
    type: TransitionType.LoginCached,
    session: { _id: "s", token: "t", userId: "u", valid: true } as never,
  });
  return { controller, client: () => client };
}

function screen(phone: boolean) {
  vi.stubGlobal("window", {
    matchMedia: vi.fn(() => ({ matches: phone })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe("opening from the kept state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    restore.mockClear();
    applied = 0;
    snapshotRead = undefined;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a phone opens from it at once", async () => {
    screen(true);
    const { controller } = setup();
    await vi.advanceTimersByTimeAsync(1);
    expect(restore).toHaveBeenCalledTimes(1);
    snapshotRead?.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.lifecycle.loadedOnce()).toBe(true);
  });

  it("a wide screen waits for the server first", async () => {
    screen(false);
    setup();
    await vi.advanceTimersByTimeAsync(1000);
    expect(restore).not.toHaveBeenCalled();
  });

  it("a wide screen opens from it when the first answer is slow", async () => {
    screen(false);
    const { controller } = setup();
    await vi.advanceTimersByTimeAsync(1600);
    expect(restore).toHaveBeenCalledTimes(1);
    snapshotRead?.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(applied).toBe(1);
    expect(controller.lifecycle.loadedOnce()).toBe(true);
    // the lifecycle still waits for the server, which corrects the kept state
    expect(controller.lifecycle.state()).toBe(State.Connecting);
  });

  it("a fast server means the kept state is never read", async () => {
    screen(false);
    const { controller, client } = setup();
    await vi.advanceTimersByTimeAsync(300);
    client().ready();
    expect(controller.lifecycle.state()).toBe(State.Connected);
    await vi.advanceTimersByTimeAsync(5000);
    expect(restore).not.toHaveBeenCalled();
  });

  it("an answer that comes while the kept state is being read wins", async () => {
    screen(true);
    const { controller, client } = setup();
    await vi.advanceTimersByTimeAsync(1);
    expect(restore).toHaveBeenCalledTimes(1);
    // the server answers before the device has read what it kept
    client().ready();
    snapshotRead?.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(applied).toBe(0);
    expect(controller.lifecycle.state()).toBe(State.Connected);
  });
});
