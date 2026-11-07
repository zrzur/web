import { afterEach, describe, expect, test, vi } from "vitest";
import { User } from "../../../../stoat.js/src/solid/classes/User";
import { customStatusPatch, writeStatusWithRetry } from "./statusWrite";

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
  test("continues hiding an offline user's text from others", () => {
    const user = make(false);
    expect(user.status?.text).toBeUndefined();
    expect(user.statusMessage()).toBeUndefined();
  });
});
