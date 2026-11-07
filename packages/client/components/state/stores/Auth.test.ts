import { describe, expect, it, vi } from "vitest";

vi.mock("@revolt/common", () => ({ CONFIGURATION: {} }));

import { Auth, TypeAuth } from "./Auth";

function makeStore(initial: TypeAuth = {}) {
  const box: { auth: TypeAuth } = { auth: initial };
  const state = {
    get: () => box.auth,
    set: (_key: string, field: keyof TypeAuth, value: never) => {
      box.auth = { ...box.auth, [field]: value };
    },
  };
  return new Auth(state as never);
}

const session = { _id: "s", token: "t", userId: "u", valid: true };

describe("the remembered name", () => {
  it("is kept for the session", () => {
    const auth = makeStore({ session });
    auth.setName("Alice");
    expect(auth.getName()).toBe("Alice");
  });

  it("is not kept without a session", () => {
    const auth = makeStore();
    auth.setName("Alice");
    expect(auth.getName()).toBeUndefined();
  });

  it("goes away on sign-out", () => {
    const auth = makeStore({ session, name: "Alice" });
    auth.removeSession();
    expect(auth.getName()).toBeUndefined();
  });

  it("does not carry over to the next account", () => {
    const auth = makeStore({ session, name: "Alice" });
    auth.setSession({ ...session, _id: "other" });
    expect(auth.getName()).toBeUndefined();
  });

  it("is dropped from stored data that has no valid session", () => {
    const auth = makeStore();
    expect(auth.clean({ name: "Alice" }).name).toBeUndefined();
    expect(auth.clean({ session, name: "Alice" }).name).toBe("Alice");
    expect(auth.clean({ session, name: 5 as never }).name).toBeUndefined();
  });
});
