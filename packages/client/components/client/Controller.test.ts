import { describe, expect, it, vi } from "vitest";

import { ConnectionState } from "@zrzur/sdk/solid";

import ClientController, { State, TransitionType } from "./Controller";

// push notifications pull in the whole interface; not needed here
vi.mock("./NotificationsController", () => ({
  killServiceWorkerSubscription: vi.fn(),
}));

/**
 * A client that records what the lifecycle asks of it
 */
function fakeClient() {
  const listeners: Record<string, (state: ConnectionState) => void> = {};
  return {
    options: {},
    events: {
      lastError: undefined as unknown,
      on: (name: string, fn: (state: ConnectionState) => void) => {
        listeners[name] = fn;
      },
    },
    emitState: (state: ConnectionState) => listeners.state(state),
    on: () => {},
    connect: vi.fn(),
    logout: vi.fn(() => Promise.resolve()),
    useExistingSession: vi.fn(),
    api: { get: vi.fn(() => Promise.resolve({ onboarding: false })) },
    account: { changeAge: vi.fn(() => Promise.resolve({ band: "adult" })) },
  };
}

function setup(options: { cached?: boolean } = {}) {
  let client = fakeClient();
  const instance = {
    apiUrl: "http://127.0.0.1:14702",
    newClient: () => (client = fakeClient()),
  };
  const state = {
    auth: {
      getSession: () =>
        options.cached === false
          ? undefined
          : { _id: "s", token: "t", userId: "u", valid: true },
      markValid: vi.fn(),
      removeSession: vi.fn(),
    },
    notifications: { isMuted: () => false, isChannelMuted: () => false },
    settings: { resetNotificationsState: vi.fn() },
  };
  const controller = new ClientController(
    state as unknown as ConstructorParameters<typeof ClientController>[0],
    instance as unknown as ConstructorParameters<typeof ClientController>[1],
  );
  return { controller, client: () => client };
}

describe("age at the first entry", () => {
  it("asks for the age when the server refuses the connection for it", () => {
    const { controller, client } = setup();
    expect(controller.lifecycle.state()).toBe(State.Connecting);

    client().events.lastError = {
      type: "server",
      data: { type: "AgeNotDeclared" },
    };
    client().emitState(ConnectionState.Disconnected);

    expect(controller.lifecycle.state()).toBe(State.AgeRequired);
    expect(controller.isLoggedIn()).toBe(false);
  });

  it("connects again once the age is declared", async () => {
    const { controller, client } = setup();
    client().events.lastError = {
      type: "server",
      data: { type: "AgeNotDeclared" },
    };
    client().emitState(ConnectionState.Disconnected);
    client().connect.mockClear();

    await controller.declareAge("1990-01");

    expect(client().account.changeAge).toHaveBeenCalledWith("1990-01");
    expect(controller.lifecycle.state()).toBe(State.Connecting);
    expect(client().connect).toHaveBeenCalledOnce();
  });

  it("stays on the question when the server refuses the age", async () => {
    const { controller, client } = setup();
    client().events.lastError = {
      type: "server",
      data: { type: "AgeNotDeclared" },
    };
    client().emitState(ConnectionState.Disconnected);
    client().account.changeAge.mockRejectedValueOnce(
      '{"type":"AgeRequirementNotMet"}',
    );

    await expect(controller.declareAge("2015-01")).rejects.toBeDefined();
    expect(controller.lifecycle.state()).toBe(State.AgeRequired);
  });

  it("can log out instead", () => {
    const { controller, client } = setup();
    client().events.lastError = {
      type: "server",
      data: { type: "AgeNotDeclared" },
    };
    client().emitState(ConnectionState.Disconnected);

    controller.lifecycle.transition({ type: TransitionType.Logout });

    expect(controller.lifecycle.state()).toBe(State.Ready);
  });
});

const SESSION = { _id: "s", token: "t", userId: "u", valid: true } as never;

function login(controller: ReturnType<typeof setup>["controller"]) {
  controller.lifecycle.transition({
    type: TransitionType.LoginUncached,
    session: SESSION,
  });
}

describe("logging in", () => {
  it("a failed hello is retried with backoff, never connected blindly, then ends in Error", async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", record);
    try {
      const { controller, client } = setup({ cached: false });
      client().api.get = vi.fn(() =>
        Promise.reject(new TypeError("Failed to fetch")),
      ) as never;
      login(controller);
      expect(controller.lifecycle.state()).toBe(State.LoggingIn);
      await vi.advanceTimersByTimeAsync(1);
      expect(client().connect).not.toHaveBeenCalled();
      expect(controller.lifecycle.state()).toBe(State.LoggingIn);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(client().api.get).toHaveBeenCalledTimes(4);
      expect(client().connect).not.toHaveBeenCalled();
      expect(controller.lifecycle.state()).toBe(State.Error);
      expect(controller.lifecycle.permanentError).toBe("InternalError");
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", record);
      vi.useRealTimers();
    }
  });

  it("a refused session while logging in reaches the logged-out message", () => {
    const { controller, client } = setup({ cached: false });
    login(controller);
    client().events.lastError = {
      type: "server",
      data: { type: "InvalidSession" },
    };
    client().emitState(ConnectionState.Disconnected);
    expect(controller.lifecycle.state()).toBe(State.Error);
    expect(controller.lifecycle.permanentError).toBe("InvalidSession");
  });

  it("a connect that throws is a temporary failure", () => {
    const { controller, client } = setup();
    client().connect = vi.fn(() => {
      throw new Error("no ws");
    });
    controller.lifecycle.transition({ type: TransitionType.Retry });
    expect(controller.lifecycle.state()).not.toBe(State.Error);
  });
});

describe("server trouble is not a refused session", () => {
  for (const type of ["DatabaseError", "InternalError"]) {
    it(`${type} keeps the session and retries`, () => {
      const { controller, client } = setup();
      client().events.lastError = { type: "server", data: { type } };
      client().emitState(ConnectionState.Disconnected);
      // (Offline when the test runtime has no network flag: both retry)
      expect([State.Disconnected, State.Offline]).toContain(
        controller.lifecycle.state(),
      );
    });
  }

  it("dismissing an error keeps a session the server still knows", () => {
    const { controller, client } = setup();
    client().events.lastError = {
      type: "server",
      data: { type: "SomethingFatal" },
    };
    client().emitState(ConnectionState.Disconnected);
    expect(controller.lifecycle.state()).toBe(State.Error);
    const first = client();
    controller.lifecycle.transition({ type: TransitionType.Dismiss });
    expect(first.logout).not.toHaveBeenCalled();
  });

  it("a failing logout is not an unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", record);
    try {
      const { controller, client } = setup();
      client().logout = vi.fn(() =>
        Promise.reject(new TypeError("Failed to fetch")),
      ) as never;
      controller.lifecycle.transition({ type: TransitionType.Logout });
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", record);
    }
  });
});
