import { afterEach, describe, expect, test, vi } from "vitest";
import { User } from "../../../../stoat.js/src/solid/classes/User";
import { customStatusPatch, statusExpiresAt } from "./statusPatch";
import { statusLine, writeStatusWithRetry } from "./statusWrite";

afterEach(() => vi.useRealTimers());

describe("custom status text", () => {
  test("writes only text, preserving the independent presence value", () => {
    expect(customStatusPatch("  hello  ")).toEqual({
      status: { text: "hello" },
    });
  });
  test("empty text explicitly removes the old field", () => {
    expect(customStatusPatch("  ")).toEqual({ remove: ["StatusText"] });
  });
  test("honours a rate-limit delay before retry", async () => {
    vi.useFakeTimers();
    const write = vi
      .fn()
      .mockRejectedValueOnce('{"retry_after":1000}')
      .mockResolvedValue(undefined);
    const completion = writeStatusWithRetry(write, {
      signal: new AbortController().signal,
    });
    await vi.advanceTimersByTimeAsync(1099);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await completion;
    expect(write).toHaveBeenCalledTimes(2);
  });
  test("cancelling the dialog stops a delayed write", async () => {
    vi.useFakeTimers();
    const cancellation = new AbortController();
    const write = vi.fn().mockRejectedValue({ retry_after: 1000 });
    const completion = writeStatusWithRetry(write, {
      signal: cancellation.signal,
    });
    const rejected = expect(completion).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(0);
    cancellation.abort();
    await rejected;
    await vi.runAllTimersAsync();
    expect(write).toHaveBeenCalledTimes(1);
  });
  test("gives up after two retries by default", async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockRejectedValue({ retry_after: 100 });
    const completion = writeStatusWithRetry(write, {
      signal: new AbortController().signal,
    });
    const rejected = expect(completion).rejects.toMatchObject({
      retry_after: 100,
    });
    await vi.runAllTimersAsync();
    await rejected;
    expect(write).toHaveBeenCalledTimes(3);
  });
  test("a longer setup can allow more retries", async () => {
    vi.useFakeTimers();
    const write = vi.fn();
    for (let i = 0; i < 5; i++)
      write.mockRejectedValueOnce({ retry_after: 100 });
    write.mockResolvedValue(undefined);
    const completion = writeStatusWithRetry(write, {
      signal: new AbortController().signal,
      retries: 8,
    });
    await vi.runAllTimersAsync();
    await completion;
    expect(write).toHaveBeenCalledTimes(6);
  });
  test("does not retry non-rate-limit failures", async () => {
    const failure = new Error("offline"),
      write = vi.fn().mockRejectedValue(failure);
    await expect(
      writeStatusWithRetry(write, { signal: new AbortController().signal }),
    ).rejects.toBe(failure);
    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe("status line", () => {
  test("puts the emoji before the text", () => {
    expect(statusLine("🍕", "At lunch")).toBe("🍕 At lunch");
  });
  test("writes a custom emoji as its code", () => {
    expect(statusLine("01J00000000000000000000000", "Hi")).toBe(
      ":01J00000000000000000000000: Hi",
    );
  });
  test("an emoji or a text alone, or nothing", () => {
    expect(statusLine("🎧", undefined)).toBe("🎧");
    expect(statusLine(undefined, "Away")).toBe("Away");
    expect(statusLine(undefined, "  ")).toBeUndefined();
  });
});

describe("status emoji and expiry", () => {
  const now = new Date(2026, 10, 10, 12, 0, 0);
  test("the expiry choices count from now", () => {
    expect(statusExpiresAt("never", now)).toBeUndefined();
    expect(statusExpiresAt("30m", now)).toBe(
      new Date(2026, 10, 10, 12, 30).toISOString(),
    );
    expect(statusExpiresAt("1h", now)).toBe(
      new Date(2026, 10, 10, 13, 0).toISOString(),
    );
    expect(statusExpiresAt("4h", now)).toBe(
      new Date(2026, 10, 10, 16, 0).toISOString(),
    );
  });
  test("today ends at local midnight", () => {
    expect(statusExpiresAt("today", now)).toBe(
      new Date(2026, 10, 11, 0, 0, 0).toISOString(),
    );
  });
  test("today a minute before midnight still leaves a minute", () => {
    const late = new Date(2026, 10, 10, 23, 59, 30);
    expect(statusExpiresAt("today", late)).toBe(
      new Date(late.getTime() + 60_000).toISOString(),
    );
  });
  test("text, emoji and expiry go together", () => {
    expect(
      customStatusPatch(" At lunch ", { emoji: "🍕", expiry: "30m", now }),
    ).toEqual({
      status: {
        text: "At lunch",
        emoji: "🍕",
        expires_at: new Date(2026, 10, 10, 12, 30).toISOString(),
      },
    });
  });
  test("an expiry already set is kept while it is in the future", () => {
    const kept = new Date(2026, 10, 10, 13, 0).toISOString();
    expect(
      customStatusPatch("Away", { keepExpiresAt: kept, now }).status
        ?.expires_at,
    ).toBe(kept);
    const past = new Date(2026, 10, 10, 11, 0).toISOString();
    expect(
      customStatusPatch("Away", { keepExpiresAt: past, now }).status
        ?.expires_at,
    ).toBeUndefined();
  });
  test("an emoji alone clears the old text", () => {
    expect(customStatusPatch("  ", { emoji: "🎧", now })).toEqual({
      status: { emoji: "🎧" },
      remove: ["StatusText"],
    });
  });
  test("no text and no emoji removes the status, expiry or not", () => {
    expect(customStatusPatch("", { expiry: "1h", now })).toEqual({
      remove: ["StatusText"],
    });
  });
});

describe("offline status privacy", () => {
  const make = (self: boolean) => {
    const client: { user?: User } = {};
    const collection = {
      client,
      getUnderlyingObject: () => ({
        online: false,
        status: { presence: "Invisible", text: "Own custom text" },
      }),
    };
    const user = new User(
      collection as unknown as ConstructorParameters<typeof User>[0],
      "test",
    );
    if (self) client.user = user;
    return user;
  };
  test("retains an invisible account owner's editable text", () => {
    const user = make(true);
    expect(user.presence).toBe("Invisible");
    expect(user.status?.text).toBe("Own custom text");
    expect(user.statusMessage()).toBe("Own custom text");
  });
  test("hides a status past its expiry without a timer", () => {
    const client: { user?: User } = {};
    const collection = {
      client,
      getUnderlyingObject: () => ({
        online: true,
        status: {
          presence: "Idle",
          text: "Old news",
          emoji: "📰",
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      }),
    };
    const user = new User(
      collection as unknown as ConstructorParameters<typeof User>[0],
      "test",
    );
    expect(user.statusMessage()).toBeUndefined();
    expect(user.statusEmoji).toBeUndefined();
    expect(user.status?.presence).toBe("Idle");
  });
  test("continues hiding an offline user's text from others", () => {
    const user = make(false);
    expect(user.status?.text).toBeUndefined();
    expect(user.statusMessage()).toBeUndefined();
  });
});
