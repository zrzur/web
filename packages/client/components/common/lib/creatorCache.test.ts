import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  answerFailed,
  answerPending,
  forgetCreators,
  isRememberedCreator,
  knownAnswer,
  patchSharedAnswer,
  rememberCreator,
  sharedAnswer,
} from "./creatorCache";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  forgetCreators();
});

describe("the remembered rank", () => {
  it("belongs to one account", () => {
    rememberCreator("a", true);
    expect(isRememberedCreator("a")).toBe(true);
    expect(isRememberedCreator("b")).toBe(false);
    expect(isRememberedCreator(undefined)).toBe(false);
  });

  it("goes when the answer changes", () => {
    rememberCreator("a", true);
    rememberCreator("a", false);
    expect(isRememberedCreator("a")).toBe(false);
  });

  it("goes for every account on logout, and leaves other keys", () => {
    localStorage.setItem("something-else", "1");
    rememberCreator("a", true);
    rememberCreator("b", true);
    forgetCreators();
    expect(isRememberedCreator("a")).toBe(false);
    expect(isRememberedCreator("b")).toBe(false);
    expect(localStorage.getItem("something-else")).toBe("1");
  });
});

describe("the answer everything reads", () => {
  it("reaches every reader, and only for that account", async () => {
    await sharedAnswer("a", async () => "rank");
    expect(knownAnswer("a")).toBe("rank");
    expect(knownAnswer("b")).toBeUndefined();
  });

  it("is kept while a new one is on its way, then replaced", async () => {
    await sharedAnswer("a", async () => "old");
    let arrive = (_: string) => {};
    const next = sharedAnswer(
      "a",
      () => new Promise<string>((done) => (arrive = done)),
      { fresh: true },
    );
    expect(answerPending()).toBe(true);
    expect(knownAnswer("a")).toBe("old");
    arrive("new");
    await next;
    expect(answerPending()).toBe(false);
    expect(knownAnswer("a")).toBe("new");
  });

  it("a fresh ask joins one already on its way", async () => {
    const load = vi.fn(() => new Promise<string>(() => {}));
    void sharedAnswer("a", load, { fresh: true });
    void sharedAnswer("a", load, { fresh: true });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("a failure with no answer yet is failed", async () => {
    const offline = async () => {
      throw new Error("offline");
    };
    await sharedAnswer("a", offline).catch(() => {});
    expect(answerFailed("a")).toBe(true);
    expect(answerFailed("b")).toBe(false);
    expect(knownAnswer("a")).toBeUndefined();
  });

  it("stays failed through the next try, until it is answered", async () => {
    const offline = async () => {
      throw new Error("offline");
    };
    await sharedAnswer("a", offline).catch(() => {});
    let arrive = (_: string) => {};
    const retry = sharedAnswer(
      "a",
      () => new Promise<string>((done) => (arrive = done)),
      { fresh: true },
    );
    expect(answerFailed("a")).toBe(true);
    expect(answerPending()).toBe(true);
    arrive("rank");
    await retry;
    expect(answerFailed("a")).toBe(false);
    expect(knownAnswer("a")).toBe("rank");
  });

  it("a failed recheck leaves the page as it is", async () => {
    await sharedAnswer("a", async () => "rank");
    await sharedAnswer(
      "a",
      async () => {
        throw new Error("offline");
      },
      { fresh: true },
    ).catch(() => {});
    expect(answerFailed("a")).toBe(false);
    expect(knownAnswer("a")).toBe("rank");
  });

  it("ignores a late answer for the account before", async () => {
    let arrive = (_: string) => {};
    const late = sharedAnswer(
      "a",
      () => new Promise<string>((done) => (arrive = done)),
    );
    await sharedAnswer("b", async () => "b rank");
    arrive("a rank");
    await late;
    expect(knownAnswer("a")).toBeUndefined();
    expect(knownAnswer("b")).toBe("b rank");
  });

  it("shows a saved change, and goes on logout", async () => {
    await sharedAnswer("a", async () => ({ on: false }));
    patchSharedAnswer<{ on: boolean }>((answer) => ({ ...answer, on: true }));
    expect(knownAnswer("a")).toEqual({ on: true });
    forgetCreators();
    expect(knownAnswer("a")).toBeUndefined();
  });
});

describe("the shared answer", () => {
  it("asks once for one account", async () => {
    const load = vi.fn(async () => "answer");
    await Promise.all([sharedAnswer("a", load), sharedAnswer("a", load)]);
    await sharedAnswer("a", load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("asks again for another account", async () => {
    const load = vi.fn(async () => "answer");
    await sharedAnswer("a", load);
    await sharedAnswer("b", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps no failure, so the next try asks again", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue("answer");
    await expect(sharedAnswer("a", load)).rejects.toThrow("offline");
    await expect(sharedAnswer("a", load)).resolves.toBe("answer");
  });

  it("is not kept for long: a new rank arrives without a reload", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => "answer");
    await sharedAnswer("a", load);
    vi.advanceTimersByTime(6 * 60 * 1000);
    await sharedAnswer("a", load);
    expect(load).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("takes a saved change, and goes on logout", async () => {
    const load = vi.fn(async () => ({ on: false }));
    await sharedAnswer("a", load);
    patchSharedAnswer<{ on: boolean }>((answer) => ({ ...answer, on: true }));
    await expect(sharedAnswer("a", load)).resolves.toEqual({ on: true });
    forgetCreators();
    await sharedAnswer("a", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
